from pydantic import BaseModel
from typing import Dict

class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: Dict[str, str]  # p256dh and auth
