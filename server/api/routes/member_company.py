"""Member company onboarding, profile, and edit requests."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.auth import get_current_user_id
from api.services.site_analysis_service import run_site_analysis_for_project
from api.services.url_reachability import UrlReachabilityError, verify_public_https_url
from models.database import get_db
from models.tables import CompanyProfileEditRequest, MemberCompanyProfile, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/member-company", tags=["member-company"])

ALLOWED_INDUSTRIES = frozenset({"university", "healthcare", "banking"})


class MemberCompanyOut(BaseModel):
    company_name: str
    company_url: str
    industry: str
    onboarding_completed_at: str | None
    site_analysis: dict | None = None
    site_analyzed_at: str | None = None


class CompleteOnboardingBody(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=500)
    company_url: str = Field(..., min_length=8, max_length=2000)
    industry: str = Field(..., min_length=1, max_length=64)


class SubmitEditBody(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=500)
    company_url: str = Field(..., min_length=8, max_length=2000)
    industry: str = Field(..., min_length=1, max_length=64)


async def _current_member_user(db: AsyncSession, user_id: str) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "member":
        raise HTTPException(status_code=403, detail="Members only")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is not active yet")
    return user


def _validate_industry(ind: str) -> str:
    s = ind.strip().lower()
    if s not in ALLOWED_INDUSTRIES:
        raise HTTPException(
            status_code=400,
            detail=f"Industry must be one of: {', '.join(sorted(ALLOWED_INDUSTRIES))}",
        )
    return s


@router.get("/profile", response_model=MemberCompanyOut | None)
async def get_my_company_profile(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    await _current_member_user(db, user_id)
    row = await db.get(MemberCompanyProfile, user_id)
    if not row or not row.onboarding_completed_at:
        return None
    return MemberCompanyOut(
        company_name=row.company_name,
        company_url=row.company_url,
        industry=row.industry,
        onboarding_completed_at=row.onboarding_completed_at.isoformat(),
        site_analysis=row.site_analysis,
        site_analyzed_at=row.site_analyzed_at.isoformat() if row.site_analyzed_at else None,
    )


@router.post("/complete-onboarding", response_model=MemberCompanyOut)
async def complete_onboarding(
    body: CompleteOnboardingBody,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user = await _current_member_user(db, user_id)
    industry = _validate_industry(body.industry)

    pending = await db.execute(
        select(CompanyProfileEditRequest).where(
            CompanyProfileEditRequest.user_id == user.id,
            CompanyProfileEditRequest.status == "pending",
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="You already have a company profile update waiting for admin approval.",
        )

    existing = await db.get(MemberCompanyProfile, user.id)
    if existing and existing.onboarding_completed_at:
        raise HTTPException(
            status_code=400,
            detail="Company profile is already set. Use request an update from My Company instead.",
        )

    name = body.company_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Company name is required")

    try:
        checked_url = await verify_public_https_url(body.company_url.strip())
    except UrlReachabilityError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message}) from e

    now = datetime.now(timezone.utc)
    profile = existing or MemberCompanyProfile(user_id=user.id, company_name="", company_url="", industry="")
    profile.company_name = name
    profile.company_url = checked_url
    profile.industry = industry
    profile.onboarding_completed_at = now
    db.add(profile)
    await db.flush()

    try:
        analysis = await run_site_analysis_for_project(
            url=checked_url,
            company_name=name,
            industry=industry,
            project_name=name,
        )
        profile.site_analysis = analysis
        profile.site_analyzed_at = datetime.now(timezone.utc)
    except Exception as e:
        logger.warning("Site analysis after onboarding failed for %s: %s", user.id, e)
        profile.site_analysis = None
        profile.site_analyzed_at = None

    await db.commit()
    await db.refresh(profile)

    return MemberCompanyOut(
        company_name=profile.company_name,
        company_url=profile.company_url,
        industry=profile.industry,
        onboarding_completed_at=profile.onboarding_completed_at.isoformat() if profile.onboarding_completed_at else None,
        site_analysis=profile.site_analysis,
        site_analyzed_at=profile.site_analyzed_at.isoformat() if profile.site_analyzed_at else None,
    )


@router.post("/submit-edit-request", response_model=dict)
async def submit_edit_request(
    body: SubmitEditBody,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    user = await _current_member_user(db, user_id)
    industry = _validate_industry(body.industry)
    name = body.company_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Company name is required")

    profile = await db.get(MemberCompanyProfile, user.id)
    if not profile or not profile.onboarding_completed_at:
        raise HTTPException(status_code=400, detail="Complete company onboarding first.")

    dup = await db.execute(
        select(CompanyProfileEditRequest).where(
            CompanyProfileEditRequest.user_id == user.id,
            CompanyProfileEditRequest.status == "pending",
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already have a pending update request.")

    try:
        checked_url = await verify_public_https_url(body.company_url.strip())
    except UrlReachabilityError as e:
        raise HTTPException(status_code=400, detail={"code": e.code, "message": e.message}) from e

    req = CompanyProfileEditRequest(
        user_id=user.id,
        proposed_company_name=name,
        proposed_company_url=checked_url,
        proposed_industry=industry,
        status="pending",
    )
    db.add(req)
    await db.commit()
    return {"ok": True, "id": req.id, "message": "Update submitted for administrator approval."}


@router.get("/industries", response_model=list[str])
async def list_industries(_: str = Depends(get_current_user_id)):
    return sorted(ALLOWED_INDUSTRIES)
