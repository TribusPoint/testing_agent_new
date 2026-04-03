from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from models.database import get_db
from models.tables import (
    TestProject, Agent, Persona, Dimension, DimensionValue,
    PersonalityProfile, InitiatingQuestion,
)
from api.schemas.generate import (
    GeneratePersonasRequest, GenerateDimensionsRequest,
    GenerateProfilesRequest, GenerateQuestionsRequest,
)
from api.schemas.projects import (
    PersonaResponse, DimensionResponse,
    PersonalityProfileResponse, InitiatingQuestionResponse,
)
from api.services.openai_service import (
    generate_personas, generate_dimensions,
    generate_personality_profiles, generate_initiating_questions,
)

router = APIRouter(prefix="/api/projects", tags=["generate"])


@router.post("/{project_id}/generate/personas", response_model=list[PersonaResponse])
async def gen_personas(
    project_id: str, body: GeneratePersonasRequest, db: AsyncSession = Depends(get_db)
):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    agent = await db.get(Agent, body.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    personas = await generate_personas(
        company_name=project.company_name or "",
        company_websites=project.company_websites or "",
        industry=project.industry or "",
        competitors=project.competitors or "",
        agent_name=agent.name,
        topics=agent.topics or [],
        actions=agent.actions or [],
    )

    saved = []
    for p in personas:
        obj = Persona(
            project_id=project_id,
            agent_id=body.agent_id,
            name=p["name"],
            description=p.get("description"),
            tag=p.get("tag"),
        )
        db.add(obj)
        saved.append(obj)

    await db.commit()
    for obj in saved:
        await db.refresh(obj)
    return saved


@router.post("/{project_id}/generate/dimensions", response_model=list[DimensionResponse])
async def gen_dimensions(
    project_id: str, body: GenerateDimensionsRequest, db: AsyncSession = Depends(get_db)
):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    dim_map = await generate_dimensions(
        company_name=project.company_name or "",
        company_websites=project.company_websites or "",
        industry=project.industry or "",
        competitors=project.competitors or "",
    )

    saved = []
    for dim_name, values in dim_map.items():
        dim = Dimension(project_id=project_id, name=dim_name)
        db.add(dim)
        await db.flush()
        for v in values:
            db.add(DimensionValue(
                dimension_id=dim.id,
                name=v["name"],
                description=v.get("description"),
            ))
        saved.append(dim)

    await db.commit()
    result = await db.execute(
        select(Dimension)
        .where(Dimension.project_id == project_id)
        .options(selectinload(Dimension.values))
    )
    return result.scalars().all()


@router.post("/{project_id}/generate/personality-profiles", response_model=list[PersonalityProfileResponse])
async def gen_profiles(
    project_id: str, body: GenerateProfilesRequest, db: AsyncSession = Depends(get_db)
):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    profiles = await generate_personality_profiles()

    saved = []
    for p in profiles:
        obj = PersonalityProfile(
            project_id=project_id,
            name=p["name"],
            description=p.get("description"),
        )
        db.add(obj)
        saved.append(obj)

    await db.commit()
    for obj in saved:
        await db.refresh(obj)
    return saved


@router.post("/{project_id}/generate/questions", response_model=list[InitiatingQuestionResponse])
async def gen_questions(
    project_id: str, body: GenerateQuestionsRequest, db: AsyncSession = Depends(get_db)
):
    project = await db.get(TestProject, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    agent = await db.get(Agent, body.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Load personas for this agent
    p_result = await db.execute(
        select(Persona).where(
            Persona.project_id == project_id,
            Persona.agent_id == body.agent_id,
        )
    )
    personas = [p.name for p in p_result.scalars().all()]
    if not personas:
        raise HTTPException(status_code=400, detail="No personas found for this agent. Generate personas first.")

    # Load dimensions + values
    d_result = await db.execute(
        select(Dimension)
        .where(Dimension.project_id == project_id)
        .options(selectinload(Dimension.values))
    )
    dim_values = [
        {"dimension": d.name, "value": v.name}
        for d in d_result.scalars().all()
        for v in d.values
    ]
    if not dim_values:
        raise HTTPException(status_code=400, detail="No dimensions found. Generate dimensions first.")

    # Load personality profiles
    pr_result = await db.execute(
        select(PersonalityProfile).where(PersonalityProfile.project_id == project_id)
    )
    profile_names = [p.name for p in pr_result.scalars().all()]
    if not profile_names:
        raise HTTPException(status_code=400, detail="No personality profiles found. Generate profiles first.")

    questions = await generate_initiating_questions(
        company_name=project.company_name or "",
        industry=project.industry or "",
        agent_name=agent.name,
        personas=personas,
        dim_values=dim_values,
        profile_names=profile_names,
        questions_per_agent=body.questions_per_agent,
    )

    saved = []
    for q in questions:
        obj = InitiatingQuestion(
            project_id=project_id,
            agent_id=body.agent_id,
            question=q["question"],
            persona=q.get("persona"),
            dimension=q.get("dimension"),
            dimension_value=q.get("dimensionValue"),
            personality_profile=q.get("personalityProfile"),
        )
        db.add(obj)
        saved.append(obj)

    await db.commit()
    for obj in saved:
        await db.refresh(obj)
    return saved
