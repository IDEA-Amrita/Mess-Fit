"""Validation for user-uploaded images (meal photos, admin menu photos).

Every image upload goes through ``read_image_upload`` so the rules live in one
place:

- The declared content type must be an allowed image type (415 otherwise).
- At most ``max_bytes`` are accepted, and never more than ``max_bytes + 1`` are
  read into memory to find out (413 otherwise).
- The bytes must actually start with that format's signature, because the
  content type is whatever the client chose to claim (415 otherwise).

Returns the bytes and a content type that is safe to pass on.
"""

from __future__ import annotations

from fastapi import HTTPException, UploadFile, status

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB — a full-resolution phone photo

# Canonical type for each accepted declared type ("image/jpg" is a common alias).
_CANONICAL = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/heic": "image/heic",
    "image/heif": "image/heic",
}
_HEIC_BRANDS = {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1", b"heim", b"heis"}


def _sniff(data: bytes) -> str | None:
    """The image format the bytes really are, or None."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in _HEIC_BRANDS:
        return "image/heic"
    return None


async def read_image_upload(file: UploadFile, max_bytes: int = MAX_IMAGE_BYTES) -> tuple[bytes, str]:
    declared = _CANONICAL.get((file.content_type or "").split(";")[0].strip().lower())
    if declared is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a JPEG, PNG, WebP or HEIC photo.",
        )

    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Photo is larger than {max_bytes // (1024 * 1024)} MB.",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The photo is empty.")

    actual = _sniff(data)
    if actual is None or actual != declared:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="That file isn't a valid image.",
        )
    return data, actual
