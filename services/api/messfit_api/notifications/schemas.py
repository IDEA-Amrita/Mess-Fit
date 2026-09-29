import re
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator

# The server POSTs to every stored endpoint (pywebpush), so an endpoint is an
# outbound request target and must never be an arbitrary URL: that would let a
# signed-in user make the API call internal addresses (SSRF). Real endpoints
# only ever come from the browsers' push services.
PUSH_SERVICE_HOSTS = (
    "fcm.googleapis.com",  # Chrome, Edge (Chromium), Opera, Brave, Samsung Internet
    "android.googleapis.com",  # legacy Chrome/GCM endpoints
    "push.services.mozilla.com",  # Firefox (updates.push.services.mozilla.com)
    "push.apple.com",  # Safari / iOS home-screen apps (web.push.apple.com)
    "notify.windows.com",  # legacy Edge / Windows (WNS)
)

_B64URL = re.compile(r"^[A-Za-z0-9_-]+={0,2}$")


def is_push_service_url(url: str) -> bool:
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not host or parts.username or parts.password or parts.port not in (None, 443):
        return False
    return any(host == h or host.endswith("." + h) for h in PUSH_SERVICE_HOSTS)


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=16, max_length=256)
    auth: str = Field(min_length=8, max_length=64)

    @field_validator("p256dh", "auth")
    @classmethod
    def _base64url(cls, v: str) -> str:
        if not _B64URL.match(v):
            raise ValueError("must be base64url")
        return v


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(max_length=2048)
    keys: PushSubscriptionKeys

    @field_validator("endpoint")
    @classmethod
    def _known_push_service(cls, v: str) -> str:
        if not is_push_service_url(v):
            raise ValueError("endpoint must be an https URL on a browser push service")
        return v


class PushSubscriptionRef(BaseModel):
    """Identifies a subscription to remove; only the endpoint is needed."""

    endpoint: str = Field(max_length=2048)


class TestNotificationOut(BaseModel):
    delivered: int


class NotificationPreferences(BaseModel):
    weekly_checkin: bool
