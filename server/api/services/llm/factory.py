from functools import lru_cache
from config import settings
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider

# Task → config model mapping
_TASK_MODELS = {
    "generation": lambda: settings.GENERATION_MODEL,
    "evaluation": lambda: settings.EVALUATION_MODEL,
    "utterance":  lambda: settings.UTTERANCE_MODEL,
}


def get_provider(task: str = "generation") -> LLMProvider:
    """
    Return the configured LLM provider for a given task.

    Tasks:
        generation  — personas, dimensions, questions (openai_service.py)
        evaluation  — scoring/judging (evaluation_service.py)
        utterance   — follow-up utterances (inspired_utterance.py)

    Provider is determined by LLM_PROVIDER in .env.
    Model per task is determined by GENERATION_MODEL / EVALUATION_MODEL / UTTERANCE_MODEL.
    """
    model = _TASK_MODELS.get(task, lambda: settings.GENERATION_MODEL)()
    provider = settings.LLM_PROVIDER.lower()

    if provider == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set in .env"
            )
        return AnthropicProvider(api_key=settings.ANTHROPIC_API_KEY, model=model)

    # Default: OpenAI
    return OpenAIProvider(api_key=settings.OPENAI_API_KEY, model=model)


def llm_config() -> dict:
    """Return the current LLM configuration for display purposes."""
    return {
        "provider": settings.LLM_PROVIDER,
        "generation_model": settings.GENERATION_MODEL,
        "evaluation_model": settings.EVALUATION_MODEL,
        "utterance_model": settings.UTTERANCE_MODEL,
    }
