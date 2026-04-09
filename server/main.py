import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api.middleware.auth import verify_api_key
from api.services.llm.factory import llm_config
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

# Protected routes — all require a valid X-API-Key or JWT
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


@app.get("/api/config")
async def get_config(_: str = Depends(verify_api_key)):
    return llm_config()
