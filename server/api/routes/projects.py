import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sql_delete
from sqlalchemy.orm import selectinload
from models.database import get_db
from models.tables import (
    TestProject, Persona, Dimension, DimensionValue,
    PersonalityProfile, InitiatingQuestion,
)
from api.schemas.projects import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    PersonaResponse, PersonaCreate, PersonaUpdate, DimensionResponse,
    PersonalityProfileResponse, InitiatingQuestionResponse,
    QuestionUpdate,
    AnalyzeSiteRequest,
)
from api.services.site_analysis_service import (
    extract_primary_url,
    run_site_analysis_for_project,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TestProject).order_by(TestProject.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = TestProject(**body.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)
):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()


# Personas

@router.get("/{project_id}/personas", response_model=list[PersonaResponse])
async def list_personas(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Persona).where(Persona.project_id == project_id)
    )
    return result.scalars().all()


@router.post("/{project_id}/personas", response_model=PersonaResponse, status_code=201)
async def create_persona(
    project_id: str, body: PersonaCreate, db: AsyncSession = Depends(get_db)
):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    persona = Persona(
        project_id=project_id,
        agent_id=body.agent_id,
        name=body.name,
        description=body.description,
        goal=body.goal,
        personality=body.personality,
        knowledge_level=body.knowledge_level,
        tag=body.tag,
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)
    return persona


@router.patch("/{project_id}/personas/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    project_id: str, persona_id: str, body: PersonaUpdate, db: AsyncSession = Depends(get_db)
):
    persona = await db.get(Persona, persona_id)
    if not persona or persona.project_id != project_id:
        raise HTTPException(status_code=404, detail="Persona not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(persona, field, value)
    await db.commit()
    await db.refresh(persona)
    return persona


@router.delete("/{project_id}/personas", status_code=204)
async def delete_all_personas(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.execute(sql_delete(Persona).where(Persona.project_id == project_id))
    await db.commit()


@router.delete("/{project_id}/personas/{persona_id}", status_code=204)
async def delete_persona(
    project_id: str, persona_id: str, db: AsyncSession = Depends(get_db)
):
    persona = await db.get(Persona, persona_id)
    if not persona or persona.project_id != project_id:
        raise HTTPException(status_code=404, detail="Persona not found")
    await db.delete(persona)
    await db.commit()


# Dimensions

@router.get("/{project_id}/dimensions", response_model=list[DimensionResponse])
async def list_dimensions(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dimension)
        .where(Dimension.project_id == project_id)
        .options(selectinload(Dimension.values))
    )
    return result.scalars().all()


@router.delete("/{project_id}/dimensions/{dimension_id}", status_code=204)
async def delete_dimension(
    project_id: str, dimension_id: str, db: AsyncSession = Depends(get_db)
):
    dim = await db.get(Dimension, dimension_id)
    if not dim or dim.project_id != project_id:
        raise HTTPException(status_code=404, detail="Dimension not found")
    await db.delete(dim)
    await db.commit()


# Personality Profiles

@router.get("/{project_id}/personality-profiles", response_model=list[PersonalityProfileResponse])
async def list_profiles(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PersonalityProfile).where(PersonalityProfile.project_id == project_id)
    )
    return result.scalars().all()


@router.delete("/{project_id}/personality-profiles/{profile_id}", status_code=204)
async def delete_profile(
    project_id: str, profile_id: str, db: AsyncSession = Depends(get_db)
):
    profile = await db.get(PersonalityProfile, profile_id)
    if not profile or profile.project_id != project_id:
        raise HTTPException(status_code=404, detail="Profile not found")
    await db.delete(profile)
    await db.commit()


# Initiating Questions

@router.get("/{project_id}/questions", response_model=list[InitiatingQuestionResponse])
async def list_questions(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InitiatingQuestion).where(InitiatingQuestion.project_id == project_id)
    )
    return result.scalars().all()


@router.patch("/{project_id}/questions/{question_id}", response_model=InitiatingQuestionResponse)
async def update_question(
    project_id: str, question_id: str, body: QuestionUpdate, db: AsyncSession = Depends(get_db)
):
    q = await db.get(InitiatingQuestion, question_id)
    if not q or q.project_id != project_id:
        raise HTTPException(status_code=404, detail="Question not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(q, field, value)
    await db.commit()
    await db.refresh(q)
    return q


@router.delete("/{project_id}/questions/{question_id}", status_code=204)
async def delete_question(
    project_id: str, question_id: str, db: AsyncSession = Depends(get_db)
):
    q = await db.get(InitiatingQuestion, question_id)
    if not q or q.project_id != project_id:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(q)
    await db.commit()


@router.post("/{project_id}/analyze-site", response_model=ProjectResponse)
async def analyze_project_site(
    project_id: str,
    body: AnalyzeSiteRequest = Body(default_factory=AnalyzeSiteRequest),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch the project website (from `company_websites` or optional body URL),
    extract text, and run an LLM to populate structured `site_analysis`.
    """
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    url = body.url or extract_primary_url(project.company_websites)
    if not url:
        raise HTTPException(
            status_code=400,
            detail="No website URL: set company websites on the project or pass { \"url\": \"https://...\" }.",
        )

    try:
        analysis = await run_site_analysis_for_project(
            url=url,
            company_name=project.company_name,
            industry=project.industry,
            project_name=project.name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception(
            "analyze-site failed project_id=%s url=%s",
            project_id,
            url,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Site analysis failed: {e!s}",
        ) from e

    project.site_analysis = analysis
    project.site_analyzed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    return project
