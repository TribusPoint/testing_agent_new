import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from config import settings
from api.middleware.auth import verify_api_key
from api.services.llm.factory import (
    PROVIDER_DEFAULT_MODELS,
    llm_config,
    log_startup_llm_env,
    provider_has_credentials,
)
from api.routes.auth import router as auth_router
from api.routes.connections import router as connections_router
from api.routes.agents import router as agents_router
from api.routes.projects import router as projects_router
from api.routes.generate import router as generate_router
from api.routes.runs import router as runs_router
from api.routes.reports import router as reports_router
from api.routes.dashboard import router as dashboard_router
from api.routes.browser import router as browser_router
from api.routes.question_repo import router as question_repo_router

logger = logging.getLogger(__name__)


async def _seed_default_admin():
    """Create a default admin account on first boot if no users exist."""
    from sqlalchemy import select, func
    from models.database import AsyncSessionLocal
    from models.tables import User
    from api.routes.auth import _hash_password

    async with AsyncSessionLocal() as db:
        count = (await db.execute(select(func.count(User.id)))).scalar() or 0
        if count > 0:
            return
        admin = User(
            email="admin@admin.com",
            password_hash=_hash_password("admin"),
            name="Admin",
            role="admin",
        )
        db.add(admin)
        await db.commit()
        logger.info("Seeded default admin account: admin@admin.com / admin")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log_startup_llm_env()
    try:
        await _seed_default_admin()
    except Exception as e:
        logger.warning("Could not seed admin (DB may not be ready): %s", e)
    yield


app = FastAPI(
    title="Testing Agent API",
    version="0.1.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "Authorization", "Accept"],
    expose_headers=["Content-Type"],
)

# Public routes — no auth required
app.include_router(auth_router)

# Protected routes — JWT Bearer, or X-API-Key with MASTER_API_KEY for automation
_auth = [Depends(verify_api_key)]
app.include_router(connections_router, dependencies=_auth)
app.include_router(agents_router, dependencies=_auth)
app.include_router(projects_router, dependencies=_auth)
app.include_router(generate_router, dependencies=_auth)
app.include_router(runs_router, dependencies=_auth)
app.include_router(reports_router, dependencies=_auth)
app.include_router(dashboard_router, dependencies=_auth)
app.include_router(browser_router, dependencies=_auth)
app.include_router(question_repo_router, dependencies=_auth)


@app.get("/ping")
async def ping():
    return "pong"


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}


class LlmProviderUpdate(BaseModel):
    provider: str = Field(..., description="openai, anthropic, or gemini")


@app.get("/api/config")
async def get_config(_: str = Depends(verify_api_key)):
    return llm_config()


def _merge_env_key_values(text: str, updates: dict[str, str]) -> str:
    """Replace existing KEY=value lines or append missing keys. Preserves unrelated lines."""
    lines = text.splitlines(keepends=True)
    done: set[str] = set()
    out: list[str] = []
    for line in lines:
        stripped = line.lstrip()
        replaced = False
        for key, val in updates.items():
            if stripped.startswith(f"{key}="):
                out.append(f"{key}={val}\n")
                done.add(key)
                replaced = True
                break
        if not replaced:
            out.append(line)
    for key, val in updates.items():
        if key not in done:
            if out and not out[-1].endswith("\n"):
                out[-1] = out[-1] + "\n"
            out.append(f"{key}={val}\n")
    return "".join(out)


@app.patch("/api/config")
async def patch_llm_provider(
    body: LlmProviderUpdate,
    _: str = Depends(verify_api_key),
):
    """Set active LLM provider and default models for that provider in server/.env (local dev)."""
    p = (body.provider or "").strip().lower()
    if p not in PROVIDER_DEFAULT_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"provider must be one of: {', '.join(sorted(PROVIDER_DEFAULT_MODELS))}",
        )
    if not provider_has_credentials(p):
        raise HTTPException(
            status_code=400,
            detail="Cannot switch to this provider: its API key is not configured on the server.",
        )
    gen_m, ev_m, ut_m = PROVIDER_DEFAULT_MODELS[p]
    updates = {
        "LLM_PROVIDER": p,
        "GENERATION_MODEL": gen_m,
        "EVALUATION_MODEL": ev_m,
        "UTTERANCE_MODEL": ut_m,
    }
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        raise HTTPException(
            status_code=503,
            detail="No server/.env file — set LLM_PROVIDER and model env vars in Railway (or create server/.env).",
        )
    text = env_path.read_text(encoding="utf-8")
    env_path.write_text(_merge_env_key_values(text, updates), encoding="utf-8")
    settings.LLM_PROVIDER = p
    settings.GENERATION_MODEL = gen_m
    settings.EVALUATION_MODEL = ev_m
    settings.UTTERANCE_MODEL = ut_m
    return llm_config()
