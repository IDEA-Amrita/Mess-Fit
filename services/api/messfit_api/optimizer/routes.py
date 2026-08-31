"""HTTP endpoint: POST /api/v1/optimize/today

Assembles one day's OptimizationInput from the authenticated user's profile
and today's mess menu, then calls the Celery task inline (V1 — no broker
needed) and returns the solved plate as JSON.

V2 upgrade path: swap ``run_optimizer(payload)`` for
``run_optimizer.delay(payload)`` and add a polling endpoint for the
AsyncResult.
"""

from __future__ import annotations

import datetime
import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from messfit_api.auth.deps import get_active_user_id
from messfit_api.db import get_session
from messfit_api.mess.models import DishExclusionORM, MessMenuORM
from messfit_api.observability.ratelimit import limiter
from messfit_api.profile.goal_engine import compute_targets
from messfit_api.profile.repository import get_hostel_context, get_profile

from .contracts import Dish, OptimizationInput
from .tasks import inp_to_dict, run_optimizer

router = APIRouter(prefix="/api/v1/optimize", tags=["optimizer"])


def _orm_to_dish(row: MessMenuORM) -> Dish:
    d = row.dish
    return Dish(
        id=str(d.id),
        name=d.name,
        category=d.category,
        diet_type=d.diet_type,
        serving_unit=d.default_serving_unit,
        serving_grams=float(d.default_serving_grams),
        portion_icon=d.portion_icon,
        kcal=float(d.kcal),
        protein_g=float(d.protein_g),
        carbs_g=float(d.carbs_g),
        fats_g=float(d.fats_g),
        fiber_g=float(d.fiber_g),
        sodium_mg=float(d.sodium_mg),
        glycemic_index=d.glycemic_index,
        allergens=tuple(d.allergens or []),
        tags=tuple(d.tags or []),
    )


@router.post("/today")
@limiter.limit("60/minute")
async def optimize_today(
    request: Request,
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Return today's optimised plate for the authenticated user.

    Requires a completed onboarding: profile, hostel context with a mess,
    and a mess menu entry for today's day of week.
    """
    uid = uuid.UUID(user_id)
    today = datetime.date.today()

    profile = await get_profile(db, uid)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile not set up — complete onboarding first",
        )

    hostel = await get_hostel_context(db, uid)
    if hostel is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Hostel context not set up — complete onboarding first",
        )
    if hostel.mess_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No mess configured in hostel context",
        )

    from messfit_api.tracking import repository as tracking_repo
    from messfit_api.tracking.metrics import compute_adaptive_tdee

    # Fetch recent data for adaptive TDEE
    start = today - datetime.timedelta(days=14)
    weights = await tracking_repo.weight_points(db, uid, start, today)
    meals = await tracking_repo.meal_rows(db, uid, start, today)
    
    # Calculate static TDEE first as a fallback/baseline
    baseline_targets = compute_targets(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=float(profile.height_cm),
        current_weight_kg=float(profile.current_weight_kg),
        target_rate_kg_per_week=float(profile.target_rate_kg_per_week),
        goal=profile.goal,
        activity_level=profile.activity_level,
        conditions=list(profile.conditions),
        today=today,
    )
    
    adaptive = compute_adaptive_tdee(weights, meals, baseline_targets.tdee)
    
    targets = compute_targets(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=float(profile.height_cm),
        current_weight_kg=float(profile.current_weight_kg),
        target_rate_kg_per_week=float(profile.target_rate_kg_per_week),
        goal=profile.goal,
        activity_level=profile.activity_level,
        conditions=list(profile.conditions),
        today=today,
        adaptive_tdee_override=adaptive.tdee if adaptive.available else None,
    )

    menu_rows = (
        await db.execute(
            select(MessMenuORM)
            .where(
                MessMenuORM.mess_id == hostel.mess_id,
                MessMenuORM.day_of_week == today.weekday(),
                MessMenuORM.effective_from <= today,
                (
                    MessMenuORM.effective_to.is_(None)
                    | (MessMenuORM.effective_to >= today)
                ),
            )
            .options(selectinload(MessMenuORM.dish))
        )
    ).scalars().all()

    if not menu_rows:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No menu found for today in this mess",
        )

    exclusion_rows = (
        await db.execute(
            select(DishExclusionORM).where(
                DishExclusionORM.user_id == uid,
                DishExclusionORM.date == today,
            )
        )
    ).scalars().all()
    skip_dish_ids = tuple(str(row.dish_id) for row in exclusion_rows)

    grouped: dict[str, list[Dish]] = defaultdict(list)
    for row in menu_rows:
        grouped[row.meal_type].append(_orm_to_dish(row))

    inp = OptimizationInput(
        daily_kcal=float(targets.daily_kcal),
        daily_protein_g=float(targets.daily_protein_g),
        daily_carbs_g=float(targets.daily_carbs_g),
        daily_fats_g=float(targets.daily_fats_g),
        diet_type=profile.diet_type,
        allergies=tuple(profile.allergies or []),
        conditions=tuple(profile.conditions or []),
        goal=profile.goal,
        menu=dict(grouped),
        canteen_items=(),
        canteen_budget_inr=hostel.canteen_typical_spend_inr,
        skip_dish_ids=skip_dish_ids,
    )

    return run_optimizer(inp_to_dict(inp))

@router.post("/photo")
@limiter.limit("10/minute")
async def optimize_photo(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> dict:
    """Extract foods from a menu/buffet photo and optimize a plate."""
    uid = uuid.UUID(user_id)
    today = datetime.date.today()

    profile = await get_profile(db, uid)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile not set up — complete onboarding first",
        )

    from messfit_api.tracking.vision import extract_menu_from_photo
    image_bytes = await file.read()
    
    try:
        # 1. Vision Extraction
        extraction = await extract_menu_from_photo(image_bytes, file.content_type or "image/jpeg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. Setup Targets
    from messfit_api.tracking import repository as tracking_repo
    from messfit_api.tracking.metrics import compute_adaptive_tdee

    start = today - datetime.timedelta(days=14)
    weights = await tracking_repo.weight_points(db, uid, start, today)
    meals = await tracking_repo.meal_rows(db, uid, start, today)
    
    baseline_targets = compute_targets(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=float(profile.height_cm),
        current_weight_kg=float(profile.current_weight_kg),
        target_rate_kg_per_week=float(profile.target_rate_kg_per_week),
        goal=profile.goal,
        activity_level=profile.activity_level,
        conditions=list(profile.conditions),
        today=today,
    )
    adaptive = compute_adaptive_tdee(weights, meals, baseline_targets.tdee)
    
    targets = compute_targets(
        dob=profile.dob,
        sex=profile.sex,
        height_cm=float(profile.height_cm),
        current_weight_kg=float(profile.current_weight_kg),
        target_rate_kg_per_week=float(profile.target_rate_kg_per_week),
        goal=profile.goal,
        activity_level=profile.activity_level,
        conditions=list(profile.conditions),
        today=today,
        adaptive_tdee_override=adaptive.tdee if adaptive.available else None,
    )

    # 3. Map Extracted Dishes to Optimizer Contracts
    dishes = []
    for ed in extraction.dishes:
        did = str(uuid.uuid4())
        dishes.append(
            Dish(
                id=did,
                name=ed.name,
                category=ed.category,
                diet_type=ed.diet_type,
                serving_unit=ed.portion_icon, # Use portion_icon as unit for AI
                serving_grams=ed.serving_grams,
                portion_icon=ed.portion_icon,
                kcal=ed.kcal,
                protein_g=ed.protein_g,
                carbs_g=ed.carbs_g,
                fats_g=ed.fats_g,
                fiber_g=0,
                sodium_mg=0,
                glycemic_index=None,
                allergens=tuple(ed.allergens),
                tags=()
            )
        )

    if not dishes:
        raise HTTPException(status_code=400, detail="No food items recognized in the image.")

    inp = OptimizationInput(
        daily_kcal=float(targets.daily_kcal),
        daily_protein_g=float(targets.daily_protein_g),
        daily_carbs_g=float(targets.daily_carbs_g),
        daily_fats_g=float(targets.daily_fats_g),
        diet_type=profile.diet_type,
        allergies=tuple(profile.allergies or []),
        conditions=tuple(profile.conditions or []),
        goal=profile.goal,
        menu={"scan": dishes}, # Dump them all into a virtual meal called 'scan'
        canteen_items=(),
        canteen_budget_inr=0,
        skip_dish_ids=(),
    )

    # 4. Run Optimizer
    output = run_optimizer(inp_to_dict(inp))
    
    # If the solver is infeasible, it will still return the best it can, but let's add the raw extracted dishes
    # so the frontend can display them if it wants to.
    output["extracted_dishes"] = [d.model_dump() for d in extraction.dishes]

    # Unlike the admin OCR pipeline, no human ever reviews a single photo-scan
    # dish before it reaches the solver — allergen exclusion here runs purely
    # on the vision model's own guess. Surface that plainly rather than let a
    # confident-looking response imply verified safety.
    if profile.allergies:
        output["allergen_disclaimer"] = (
            "Allergen filtering on photo-scanned food is AI-estimated from "
            "the image, not verified by a person. If you have a severe or "
            "life-threatening allergy, don't rely on this alone — check with "
            "mess staff before eating."
        )

    return output
