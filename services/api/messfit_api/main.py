from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth.deps import get_current_user_id
from .config import settings
from .profile.router import router as profile_router

app = FastAPI(title="MessFit API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": app.version}


@app.get("/api/v1/me")
async def me(user_id: str = Depends(get_current_user_id)):
    return {"user_id": user_id}


app.include_router(profile_router)
