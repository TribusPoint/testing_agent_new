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

app = FastAPI(
    title="Testing Agent API",
    version="0.1.0",
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes — no auth required
app.include_router(auth_router)

# Protected routes — all require a valid X-API-Key
_auth = [Depends(verify_api_key)]
app.include_router(connections_router, dependencies=_auth)
app.include_router(agents_router, dependencies=_auth)
app.include_router(projects_router, dependencies=_auth)
app.include_router(generate_router, dependencies=_auth)
app.include_router(runs_router, dependencies=_auth)
app.include_router(reports_router, dependencies=_auth)
app.include_router(dashboard_router, dependencies=_auth)
app.include_router(browser_router, dependencies=_auth)


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV}


@app.get("/api/config")
async def get_config(_: str = Depends(verify_api_key)):
    return llm_config()
