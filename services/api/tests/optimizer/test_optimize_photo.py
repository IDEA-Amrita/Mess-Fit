"""Integration tests for POST /api/v1/optimize/photo."""

from __future__ import annotations

from httpx import AsyncClient

from messfit_api.tracking.vision import MenuExtractionResult, ExtractedDish

URL = "/api/v1/optimize/photo"

_FAKE_EXTRACTION = MenuExtractionResult(
    dishes=[
        ExtractedDish(
            name="Paneer Butter Masala",
            category="curry",
            diet_type="veg",
            portion_icon="katori",
            serving_grams=150.0,
            kcal=280.0,
            protein_g=12.0,
            carbs_g=10.0,
            fats_g=22.0,
        )
    ]
)

_FAKE_EXTRACTION_WITH_ALLERGEN = MenuExtractionResult(
    dishes=[
        ExtractedDish(
            name="Egg Roast",
            category="curry",
            diet_type="egg",
            portion_icon="katori",
            serving_grams=100.0,
            kcal=150.0,
            protein_g=6.0,
            carbs_g=5.0,
            fats_g=10.0,
            allergens=["eggs"],
        )
    ]
)

_FAKE_RESULT: dict = {
    "plan": {
        "scan": [
            {
                "dish_id": "test-dish-id",
                "name": "Paneer Butter Masala",
                "portions": 1.0,
                "serving_unit": "katori",
                "portion_icon": "katori",
                "grams": 150.0,
                "kcal": 280.0,
                "protein_g": 12.0,
                "carbs_g": 10.0,
                "fats_g": 22.0,
                "reason": "Top protein source",
            }
        ]
    },
    "daily_totals": {"kcal": 280.0, "protein_g": 12.0, "carbs_g": 10.0, "fats_g": 22.0},
    "daily_targets": {"kcal": 2000.0, "protein_g": 96.0, "carbs_g": 220.0, "fats_g": 55.0},
    "gap_fills": [],
    "solver_status": "Optimal",
    "solve_time_ms": 55,
}

# Minimal bytes with a real JPEG signature (uploads are signature-checked).
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16

class TestUnauthed:
    async def test_no_auth_header_rejected(self, unauthed_client: AsyncClient):
        r = await unauthed_client.post(URL)
        assert r.status_code in (401, 422)

class TestOnboardingErrors:
    async def test_no_profile_returns_409(self, client: AsyncClient):
        file_content = JPEG
        files = {"file": ("test.jpg", file_content, "image/jpeg")}
        r = await client.post(URL, files=files)
        assert r.status_code == 409
        assert "profile" in r.json()["detail"].lower()

class TestHappyPath:
    async def test_returns_200_with_plan(
        self, client: AsyncClient, make_profile_payload, monkeypatch
    ):
        await client.put("/api/v1/profile/me", json=make_profile_payload())

        async def mock_extract(*args, **kwargs):
            return _FAKE_EXTRACTION

        monkeypatch.setattr(
            "messfit_api.tracking.vision.extract_menu_from_photo",
            mock_extract,
        )
        monkeypatch.setattr(
            "messfit_api.optimizer.routes.run_optimizer",
            lambda _payload: dict(_FAKE_RESULT),
        )

        file_content = JPEG
        files = {"file": ("test.jpg", file_content, "image/jpeg")}
        r = await client.post(URL, files=files)
        
        assert r.status_code == 200, r.text
        body = r.json()
        assert "plan" in body
        assert "daily_totals" in body
        assert "daily_targets" in body
        assert "solver_status" in body
        assert "extracted_dishes" in body
        assert len(body["extracted_dishes"]) == 1
        assert body["extracted_dishes"][0]["name"] == "Paneer Butter Masala"


class TestAllergenWiring:
    async def test_extracted_allergens_reach_the_optimizer_payload(
        self, client: AsyncClient, make_profile_payload, monkeypatch
    ):
        # Regression guard: photo-scanned dishes used to hardcode
        # allergens=() regardless of what the vision model detected, so the
        # solver's allergen exclusion never had anything to exclude on.
        await client.put("/api/v1/profile/me", json=make_profile_payload(allergies=["eggs"]))

        async def mock_extract(*args, **kwargs):
            return _FAKE_EXTRACTION_WITH_ALLERGEN

        captured: dict = {}

        def mock_run_optimizer(payload):
            captured.update(payload)
            return dict(_FAKE_RESULT)

        monkeypatch.setattr(
            "messfit_api.tracking.vision.extract_menu_from_photo", mock_extract
        )
        monkeypatch.setattr(
            "messfit_api.optimizer.routes.run_optimizer", mock_run_optimizer
        )

        file_content = JPEG
        files = {"file": ("test.jpg", file_content, "image/jpeg")}
        r = await client.post(URL, files=files)

        assert r.status_code == 200, r.text
        scanned = captured["menu"]["scan"][0]
        assert list(scanned["allergens"]) == ["eggs"]
        assert captured["allergies"] == ["eggs"]

    async def test_response_carries_a_disclaimer_when_user_has_allergies(
        self, client: AsyncClient, make_profile_payload, monkeypatch
    ):
        await client.put("/api/v1/profile/me", json=make_profile_payload(allergies=["nuts"]))

        async def mock_extract(*args, **kwargs):
            return _FAKE_EXTRACTION

        monkeypatch.setattr(
            "messfit_api.tracking.vision.extract_menu_from_photo", mock_extract
        )
        monkeypatch.setattr(
            "messfit_api.optimizer.routes.run_optimizer", lambda _payload: dict(_FAKE_RESULT)
        )

        file_content = JPEG
        files = {"file": ("test.jpg", file_content, "image/jpeg")}
        r = await client.post(URL, files=files)

        assert r.status_code == 200, r.text
        assert "allergen_disclaimer" in r.json()

    async def test_no_disclaimer_when_user_has_no_declared_allergies(
        self, client: AsyncClient, make_profile_payload, monkeypatch
    ):
        await client.put("/api/v1/profile/me", json=make_profile_payload(allergies=[]))

        async def mock_extract(*args, **kwargs):
            return _FAKE_EXTRACTION

        monkeypatch.setattr(
            "messfit_api.tracking.vision.extract_menu_from_photo", mock_extract
        )
        monkeypatch.setattr(
            "messfit_api.optimizer.routes.run_optimizer", lambda _payload: dict(_FAKE_RESULT)
        )

        file_content = JPEG
        files = {"file": ("test.jpg", file_content, "image/jpeg")}
        r = await client.post(URL, files=files)

        assert r.status_code == 200, r.text
        assert "allergen_disclaimer" not in r.json()
