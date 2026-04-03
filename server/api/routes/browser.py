from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.services.browser_service import probe_page

router = APIRouter(prefix="/api/browser", tags=["browser"])


class ProbeRequest(BaseModel):
    url: str


@router.post("/probe")
async def probe_url(body: ProbeRequest):
    """
    Open *url* in a headless browser, try to click any chat launcher,
    then scan the page (and all iframes) for chat widget selectors.
    Returns suggested selectors and a screenshot.
    """
    result = await probe_page(body.url)
    return JSONResponse(result)
