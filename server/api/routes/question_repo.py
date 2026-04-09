from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete as sa_delete

from models.database import get_db
from models.tables import RepoQuestion, InitiatingQuestion

router = APIRouter(prefix="/api/repo/questions", tags=["question-repo"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RepoQuestionCreate(BaseModel):
    question: str
    expected_answer: str | None = None
    domain: str = "general"
    category: str = "uncategorized"
    tags: list[str] = []
    persona: str | None = None
    dimension: str | None = None
    dimension_value: str | None = None
    personality_profile: str | None = None


class RepoQuestionUpdate(BaseModel):
    question: str | None = None
    expected_answer: str | None = None
    domain: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    persona: str | None = None
    dimension: str | None = None
    dimension_value: str | None = None
    personality_profile: str | None = None


class RepoQuestionResponse(BaseModel):
    id: str
    question: str
    expected_answer: str | None
    domain: str
    category: str
    tags: list[str]
    source_project_id: str | None
    persona: str | None
    dimension: str | None
    dimension_value: str | None
    personality_profile: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class PromoteRequest(BaseModel):
    question_ids: list[str]
    domain: str = "general"
    category: str = "uncategorized"
    tags: list[str] = []


class DomainCategoryInfo(BaseModel):
    domain: str
    categories: list[str]
    count: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_response(q: RepoQuestion) -> RepoQuestionResponse:
    return RepoQuestionResponse(
        id=q.id,
        question=q.question,
        expected_answer=q.expected_answer,
        domain=q.domain,
        category=q.category,
        tags=q.tags if isinstance(q.tags, list) else [],
        source_project_id=q.source_project_id,
        persona=q.persona,
        dimension=q.dimension,
        dimension_value=q.dimension_value,
        personality_profile=q.personality_profile,
        created_at=q.created_at.isoformat() if q.created_at else "",
        updated_at=q.updated_at.isoformat() if q.updated_at else "",
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=list[RepoQuestionResponse])
async def list_repo_questions(
    domain: str | None = Query(None),
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(RepoQuestion).order_by(RepoQuestion.created_at.desc())
    if domain:
        query = query.where(RepoQuestion.domain == domain)
    if category:
        query = query.where(RepoQuestion.category == category)
    if search:
        query = query.where(RepoQuestion.question.ilike(f"%{search}%"))
    result = await db.execute(query)
    return [_to_response(q) for q in result.scalars().all()]


@router.get("/domains", response_model=list[DomainCategoryInfo])
async def list_domains(db: AsyncSession = Depends(get_db)):
    """Return all distinct domain/category combos with counts."""
    result = await db.execute(
        select(
            RepoQuestion.domain,
            RepoQuestion.category,
            func.count(RepoQuestion.id).label("cnt"),
        )
        .group_by(RepoQuestion.domain, RepoQuestion.category)
        .order_by(RepoQuestion.domain, RepoQuestion.category)
    )
    rows = result.all()
    domains: dict[str, DomainCategoryInfo] = {}
    for domain, category, cnt in rows:
        if domain not in domains:
            domains[domain] = DomainCategoryInfo(domain=domain, categories=[], count=0)
        domains[domain].categories.append(category)
        domains[domain].count += cnt
    return list(domains.values())


@router.post("", response_model=RepoQuestionResponse, status_code=201)
async def create_repo_question(
    body: RepoQuestionCreate,
    db: AsyncSession = Depends(get_db),
):
    q = RepoQuestion(
        question=body.question,
        expected_answer=body.expected_answer,
        domain=body.domain,
        category=body.category,
        tags=body.tags,
        persona=body.persona,
        dimension=body.dimension,
        dimension_value=body.dimension_value,
        personality_profile=body.personality_profile,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return _to_response(q)


@router.get("/{question_id}", response_model=RepoQuestionResponse)
async def get_repo_question(question_id: str, db: AsyncSession = Depends(get_db)):
    q = await db.get(RepoQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return _to_response(q)


@router.patch("/{question_id}", response_model=RepoQuestionResponse)
async def update_repo_question(
    question_id: str,
    body: RepoQuestionUpdate,
    db: AsyncSession = Depends(get_db),
):
    q = await db.get(RepoQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    for field in ("question", "expected_answer", "domain", "category", "tags", "persona", "dimension", "dimension_value", "personality_profile"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(q, field, val)
    await db.commit()
    await db.refresh(q)
    return _to_response(q)


@router.delete("/{question_id}", status_code=204)
async def delete_repo_question(question_id: str, db: AsyncSession = Depends(get_db)):
    q = await db.get(RepoQuestion, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(q)
    await db.commit()


# ---------------------------------------------------------------------------
# Promote project questions to the repo
# ---------------------------------------------------------------------------

@router.post("/promote", response_model=list[RepoQuestionResponse], status_code=201)
async def promote_to_repo(
    body: PromoteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Copy project questions (by ID) into the global repo with the given domain/category."""
    result = await db.execute(
        select(InitiatingQuestion).where(InitiatingQuestion.id.in_(body.question_ids))
    )
    source_questions = result.scalars().all()
    if not source_questions:
        raise HTTPException(status_code=404, detail="No matching questions found")

    created = []
    for sq in source_questions:
        rq = RepoQuestion(
            question=sq.question,
            expected_answer=sq.expected_answer,
            domain=body.domain,
            category=body.category,
            tags=body.tags,
            source_project_id=sq.project_id,
            persona=sq.persona,
            dimension=sq.dimension,
            dimension_value=sq.dimension_value,
            personality_profile=sq.personality_profile,
        )
        db.add(rq)
        created.append(rq)

    await db.commit()
    for rq in created:
        await db.refresh(rq)
    return [_to_response(rq) for rq in created]
