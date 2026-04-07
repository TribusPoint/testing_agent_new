import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.database import Base

def new_uuid():
    return str(uuid.uuid4())


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    key_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SalesforceConnection(Base):
    __tablename__ = "salesforce_connections"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # connection_type: "salesforce" | "http"
    connection_type: Mapped[str] = mapped_column(Text, nullable=False, default="salesforce")
    # Salesforce fields (nullable for HTTP connections)
    domain: Mapped[str] = mapped_column(Text, nullable=False, default="")
    consumer_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    consumer_secret: Mapped[str] = mapped_column(Text, nullable=False, default="")
    default_agent_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Generic config for non-Salesforce connection types (auth, base_url, etc.)
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # DB uses ON DELETE CASCADE on agents.connection_id; tell ORM not to null FKs first.
    agents: Mapped[list["Agent"]] = relationship(
        "Agent", back_populates="connection", passive_deletes=True
    )


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    connection_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("salesforce_connections.id", ondelete="CASCADE"))
    salesforce_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    developer_name: Mapped[str] = mapped_column(Text, nullable=False)
    agent_type: Mapped[str] = mapped_column(Text, nullable=False, default="service")
    planner_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    planner_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    runtime_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # HTTP agent config: {endpoint, method, headers, body_template, response_path}
    config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    topics: Mapped[dict] = mapped_column(JSONB, default=list)
    actions: Mapped[dict] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    connection: Mapped["SalesforceConnection"] = relationship("SalesforceConnection", back_populates="agents")


class TestProject(Base):
    __tablename__ = "test_projects"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_websites: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry: Mapped[str | None] = mapped_column(Text, nullable=True)
    competitors: Mapped[str | None] = mapped_column(Text, nullable=True)
    # LLM-derived website analysis (see site_analysis_service)
    site_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    site_analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class ProjectAgent(Base):
    __tablename__ = "project_agents"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_projects.id", ondelete="CASCADE"))
    agent_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("agents.id", ondelete="CASCADE"))


class Persona(Base):
    __tablename__ = "personas"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_projects.id", ondelete="CASCADE"))
    agent_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    # Short "who they are" line (UI: Persona)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tag: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    personality: Mapped[str | None] = mapped_column(Text, nullable=True)
    knowledge_level: Mapped[str | None] = mapped_column(Text, nullable=True)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Dimension(Base):
    __tablename__ = "dimensions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text, nullable=False)

    values: Mapped[list["DimensionValue"]] = relationship("DimensionValue", back_populates="dimension")


class DimensionValue(Base):
    __tablename__ = "dimension_values"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    dimension_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("dimensions.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    dimension: Mapped["Dimension"] = relationship("Dimension", back_populates="values")


class PersonalityProfile(Base):
    __tablename__ = "personality_profiles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class InitiatingQuestion(Base):
    __tablename__ = "initiating_questions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_projects.id", ondelete="CASCADE"))
    agent_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("agents.id", ondelete="CASCADE"))
    question: Mapped[str] = mapped_column(Text, nullable=False)
    expected_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    persona: Mapped[str | None] = mapped_column(Text, nullable=True)
    dimension: Mapped[str | None] = mapped_column(Text, nullable=True)
    dimension_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    personality_profile: Mapped[str | None] = mapped_column(Text, nullable=True)


class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_projects.id", ondelete="CASCADE"))
    agent_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("agents.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    completed_questions: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    results: Mapped[list["TestRunResult"]] = relationship(
        "TestRunResult", back_populates="run", passive_deletes=True
    )


class TestRunResult(Base):
    __tablename__ = "test_run_results"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("test_runs.id", ondelete="CASCADE"))
    question_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("initiating_questions.id", ondelete="SET NULL"), nullable=True)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_utterances: Mapped[dict] = mapped_column(JSONB, default=list)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answered: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evaluation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    human_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    human_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")

    run: Mapped["TestRun"] = relationship("TestRun", back_populates="results")
