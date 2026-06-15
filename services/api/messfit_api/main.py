from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .auth.deps import get_current_user_id
from .chatbot.router import router as chatbot_router
from .config import settings
from .mess.routes import router as mess_router
from .observability.ratelimit import limiter
from .observability.sentry import init_sentry
from .observability.setup import setup_otel
from .optimizer.routes import router as optimizer_router
from .profile.router import router as profile_router
from .tracking.router import router as tracking_router
from .workouts.router import router as workouts_router

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
app.include_router(mess_router)
app.include_router(optimizer_router)
app.include_router(workouts_router)
app.include_router(tracking_router)
app.include_router(chatbot_router)
