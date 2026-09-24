import uuid
from typing import Any
from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
import structlog
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .account.router import router as account_router
from .analytics.router import router as analytics_router
from .auth.deps import get_active_user_id
from .auth.models import UserORM
from .chatbot.router import router as chatbot_router
from .config import settings
from .db import get_session
from .mess.routes import router as mess_router
from .observability.ratelimit import limiter
from .observability.sentry import init_sentry
from .observability.setup import setup_otel
from .optimizer.routes import router as optimizer_router
from .profile.router import router as profile_router
from .tracking.router import router as tracking_router
from .workouts.router import router as workouts_router
from .logging_config import configure_logging
from .notifications.router import router as notifications_router

# Structured logging — must be called before anything else logs.
configure_logging()

logger = structlog.get_logger(__name__)

# Error reporting — no-op unless SENTRY_DSN is set. Init before the app so the
# Sentry FastAPI/Starlette integrations patch correctly.
init_sentry(settings)

app = FastAPI(title="MessFit API", version="0.1.0")

# Tracing — no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is configured.
setup_otel(app)

# Rate limiting (slowapi): expose the shared limiter and return 429 on overflow.
app.state.limiter = limiter
# slowapi's handler is typed (Request, RateLimitExceeded); Starlette wants
# (Request, Exception). Compatible at runtime — the registry keys on the type.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception", path=request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.get("/health")
async def health() -> Any:
    return {"status": "ok", "version": app.version}


@app.get("/api/v1/me")
async def me(
    user_id: str = Depends(get_active_user_id),
    db: AsyncSession = Depends(get_session),
) -> Any:
    # role comes from the DB, never the JWT — same rule require_admin
    # already follows (see its docstring): the DB is the source of truth
    # for app roles. The frontend's admin-route gate reads this.
    result = await db.execute(select(UserORM.role).where(UserORM.id == uuid.UUID(user_id)))
    role = result.scalar_one_or_none() or "user"
    return {"user_id": user_id, "role": role}


app.include_router(profile_router)
app.include_router(mess_router)
app.include_router(optimizer_router)
app.include_router(workouts_router)
app.include_router(tracking_router)
app.include_router(chatbot_router)
app.include_router(account_router)
app.include_router(notifications_router)
app.include_router(analytics_router)
