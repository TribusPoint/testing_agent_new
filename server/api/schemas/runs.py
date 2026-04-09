from pydantic import BaseModel
from datetime import datetime


class RunCreate(BaseModel):
    project_id: str
    agent_id: str
    question_ids: list[str] | None = None
    repo_question_ids: list[str] | None = None


class RunResponse(BaseModel):
    id: str
    project_id: str
    agent_id: str
    status: str
    total_questions: int
    completed_questions: int
    started_at: datetime | None
    completed_at: datetime | None
    last_error: str | None = None

    model_config = {"from_attributes": True}


class RunResultResponse(BaseModel):
    id: str
    run_id: str
    question_id: str | None
    question_text: str
    response_text: str | None
    follow_up_utterances: list
    latency_ms: int | None
    answered: bool | None
    score: int | None
    evaluation_notes: str | None
    human_score: int | None
    human_notes: str | None
    status: str

    model_config = {"from_attributes": True}


class ResultAnnotate(BaseModel):
    human_score: int | None = None
    human_notes: str | None = None


class QuestionDelta(BaseModel):
    question_id: str | None
    question_text: str
    score_a: int | None
    score_b: int | None
    delta: int | None


class RunComparison(BaseModel):
    run_a: str
    run_b: str
    avg_score_a: float | None
    avg_score_b: float | None
    avg_delta: float | None
    questions: list[QuestionDelta]


class ScoreDistribution(BaseModel):
    bucket_0_25: int
    bucket_26_50: int
    bucket_51_75: int
    bucket_76_100: int


class RunReport(BaseModel):
    run_id: str
    status: str
    total_results: int
    completed_results: int
    pass_count: int
    pass_rate: float
    avg_score: float | None
    avg_latency_ms: float | None
    score_distribution: ScoreDistribution


class InspiredUtteranceRequest(BaseModel):
    initiating_question: str
    persona: str
    personality_profile: str
    conversation: list[dict]
