"""Supabase Storage adapter for mess-menu photos.

A thin httpx wrapper over the Supabase Storage REST API — we don't pull the
full supabase-py SDK just for three calls (upload, sign, download). All access
uses the service-role key, so the bucket stays private: the browser never
touches Storage directly, and the review UI only ever sees short-lived signed
URLs minted here.

Bucket must exist (create once in the Supabase dashboard): ``mess-menu-photos``.
"""

from __future__ import annotations

import uuid

import httpx

from ..config import settings

BUCKET = "mess-menu-photos"
_SIGNED_URL_TTL_S = 600  # 10 min — long enough to review, short enough to be safe


class StorageError(RuntimeError):
    """Raised when a Storage operation fails (network, auth, missing object)."""


def _base_url() -> str:
    return f"{settings.supabase_url}/storage/v1"


def _headers() -> dict[str, str]:
    key = settings.supabase_service_role_key
    return {"Authorization": f"Bearer {key}", "apikey": key}


def _ext_for(content_type: str) -> str:
    return {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/heic": "heic",
    }.get(content_type.lower(), "jpg")


async def upload_menu_photo(image_bytes: bytes, content_type: str, mess_id: uuid.UUID) -> str:
    """Upload bytes to the private bucket; return the storage object path.

    The path (not a URL) is what we persist in ``ocr_jobs.photo_url`` — URLs
    expire, paths don't.
    """
    path = f"{mess_id}/{uuid.uuid4().hex}.{_ext_for(content_type)}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_base_url()}/object/{BUCKET}/{path}",
            headers={**_headers(), "Content-Type": content_type},
            content=image_bytes,
        )
    if resp.status_code not in (200, 201):
        raise StorageError(f"upload failed ({resp.status_code}): {resp.text}")
    return path


async def download_menu_photo(path: str) -> bytes:
    """Fetch the raw bytes for a stored object (used by the worker)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{_base_url()}/object/{BUCKET}/{path}", headers=_headers())
    if resp.status_code != 200:
        raise StorageError(f"download failed ({resp.status_code}): {resp.text}")
    return resp.content


async def signed_url(path: str, expires_in: int = _SIGNED_URL_TTL_S) -> str:
    """Mint a short-lived signed URL so the review UI can display the photo."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_base_url()}/object/sign/{BUCKET}/{path}",
            headers=_headers(),
            json={"expiresIn": expires_in},
        )
    if resp.status_code != 200:
        raise StorageError(f"sign failed ({resp.status_code}): {resp.text}")
    signed = resp.json().get("signedURL") or resp.json().get("signedUrl")
    if not signed:
        raise StorageError(f"sign response missing URL: {resp.text}")
    return f"{settings.supabase_url}/storage/v1{signed}"
