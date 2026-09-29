"""Image upload validation (messfit_api/uploads.py) and the meal-photo endpoint
that uses it. DB-free: the endpoint only needs an authenticated caller."""

from __future__ import annotations

import io
from types import SimpleNamespace

import httpx
import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from messfit_api.auth.deps import get_active_user_id
from messfit_api.main import app
from messfit_api.tracking import router as tracking_router
from messfit_api.uploads import read_image_upload

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 16
HEIC = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 16


def _upload(data: bytes, content_type: str) -> UploadFile:
    return UploadFile(io.BytesIO(data), filename="x", headers=Headers({"content-type": content_type}))


class _CountingFile(io.BytesIO):
    """Records the largest read, to prove oversized uploads aren't slurped."""

    max_read = 0

    def read(self, size: int = -1) -> bytes:  # type: ignore[override]
        chunk = super().read(size)
        _CountingFile.max_read = max(_CountingFile.max_read, len(chunk))
        return chunk


# ─── helper ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("data", "declared", "canonical"),
    [
        (JPEG, "image/jpeg", "image/jpeg"),
        (JPEG, "image/jpg", "image/jpeg"),
        (PNG, "image/png", "image/png"),
        (WEBP, "image/webp", "image/webp"),
        (HEIC, "image/heic", "image/heic"),
        (HEIC, "image/heif", "image/heic"),
    ],
)
async def test_accepts_real_images_and_normalises_the_type(data, declared, canonical):
    body, content_type = await read_image_upload(_upload(data, declared))
    assert body == data
    assert content_type == canonical


@pytest.mark.parametrize("declared", ["text/plain", "application/pdf", "image/svg+xml", "image/gif", ""])
async def test_rejects_types_outside_the_allow_list(declared):
    with pytest.raises(HTTPException) as e:
        await read_image_upload(_upload(JPEG, declared))
    assert e.value.status_code == 415


async def test_rejects_bytes_that_are_not_the_declared_image():
    # A script renamed to .jpg, and a PNG claiming to be a JPEG.
    for data, declared in [(b"<script>alert(1)</script>", "image/jpeg"), (PNG, "image/jpeg")]:
        with pytest.raises(HTTPException) as e:
            await read_image_upload(_upload(data, declared))
        assert e.value.status_code == 415


async def test_rejects_an_empty_file():
    with pytest.raises(HTTPException) as e:
        await read_image_upload(_upload(b"", "image/jpeg"))
    assert e.value.status_code == 400


async def test_oversized_upload_is_refused_without_reading_it_all():
    limit = 1024
    f = _CountingFile(JPEG + b"\x00" * (limit * 50))
    _CountingFile.max_read = 0
    upload = UploadFile(f, filename="big.jpg", headers=Headers({"content-type": "image/jpeg"}))
    with pytest.raises(HTTPException) as e:
        await read_image_upload(upload, max_bytes=limit)
    assert e.value.status_code == 413
    assert _CountingFile.max_read <= limit + 1


async def test_exactly_the_limit_is_allowed():
    data = JPEG + b"\x00" * (100 - len(JPEG))
    body, _ = await read_image_upload(_upload(data, "image/jpeg"), max_bytes=100)
    assert len(body) == 100


# ─── POST /api/v1/logs/photo ─────────────────────────────────────────────


@pytest.fixture
def api(monkeypatch):
    seen: list[tuple[int, str]] = []

    async def fake_estimate(image_bytes: bytes, content_type: str):
        seen.append((len(image_bytes), content_type))
        return SimpleNamespace(
            dishes=[{"name": "Idli", "portion": "3"}],
            total_kcal=300, total_protein_g=9, total_carbs_g=60, total_fats_g=2, confidence="high",
        )

    monkeypatch.setattr(tracking_router, "estimate_meal_from_photo", fake_estimate)
    app.dependency_overrides[get_active_user_id] = lambda: "00000000-0000-0000-0000-0000000000cc"
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")
    yield client, seen
    app.dependency_overrides.clear()


async def test_photo_estimate_happy_path(api):
    client, seen = api
    r = await client.post(
        "/api/v1/logs/photo",
        files={"photo": ("plate.jpg", JPEG, "image/jpeg")},
        data={"meal_type": "dinner"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["meal_type"] == "dinner"
    assert r.json()["total_kcal"] == 300
    assert seen == [(len(JPEG), "image/jpeg")]


async def test_photo_rejects_a_non_image_before_calling_the_model(api):
    client, seen = api
    r = await client.post("/api/v1/logs/photo", files={"photo": ("a.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 415
    assert seen == []  # never reached the (paid) vision model


async def test_photo_requires_a_file_and_a_known_meal(api):
    client, seen = api
    assert (await client.post("/api/v1/logs/photo", data={"meal_type": "lunch"})).status_code == 422
    r = await client.post(
        "/api/v1/logs/photo",
        files={"photo": ("plate.jpg", JPEG, "image/jpeg")},
        data={"meal_type": "midnight-feast"},
    )
    assert r.status_code == 422
    assert seen == []
