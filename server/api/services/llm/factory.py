import logging
from config import settings
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider

_log = logging.getLogger(__name__)


def _sanitize_secret_key(raw: str | None) -> str:
    """
    Normalize API keys from env / Railway / copy-paste:
    trim, strip wrapping quotes, remove BOM, collapse accidental whitespace/newlines.
    """
    if raw is None:
        return ""
    s = str(raw).strip()
    s = s.removeprefix("\ufeff")
    for _ in range(3):
        if len(s) >= 2 and s[0] == s[-1] and s[0] in '"\'`':
            s = s[1:-1].strip()
    s = "".join(s.split())
    return s


def _looks_like_dummy_openai_key(key: str) -> bool:
    """Catch template values like sk-placeholder that Railway/docs use by mistake."""
    if not key:
        return True
    lower = key.lower()
    if "placeholder" in lower:
        return True
    if lower in ("sk-...", "sk-…"):
        return True
    if "your-api-key" in lower or "your_openai" in lower:
        return True
    return False


def log_startup_llm_env() -> None:
    """Log non-secret diagnostics so Railway logs show whether keys loaded (length only)."""
    prov = (settings.LLM_PROVIDER or "openai").strip().lower()
    if prov == "anthropic":
        n = len(_sanitize_secret_key(settings.ANTHROPIC_API_KEY))
        _log.info("LLM startup: LLM_PROVIDER=%s ANTHROPIC_API_KEY length=%s", prov, n)
    elif prov == "gemini":
        n = len(_sanitize_secret_key(settings.GOOGLE_API_KEY))
        _log.info("LLM startup: LLM_PROVIDER=%s GOOGLE_API_KEY length=%s", prov, n)
    else:
        n = len(_sanitize_secret_key(settings.OPENAI_API_KEY))
        _log.info(
            "LLM startup: LLM_PROVIDER=%s OPENAI_API_KEY length=%s (real keys are usually 50+ chars)",
            prov,
            n,
        )


# Default (generation, evaluation, utterance) when switching provider via PATCH /api/config
PROVIDER_DEFAULT_MODELS: dict[str, tuple[str, str, str]] = {
    "openai": ("gpt-4o", "gpt-4o", "gpt-4o-mini"),
    "anthropic": ("claude-3-5-sonnet-20241022", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"),
    "gemini": ("gemini-2.0-flash", "gemini-2.0-flash", "gemini-2.0-flash"),
}


def provider_has_credentials(provider: str) -> bool:
    """Whether the deployment has a usable API key for this provider (for UI + PATCH validation)."""
    p = (provider or "").strip().lower()
    if p == "openai":
        okey = _sanitize_secret_key(settings.OPENAI_API_KEY)
        return bool(okey) and not _looks_like_dummy_openai_key(okey)
    if p == "anthropic":
        return bool(_sanitize_secret_key(settings.ANTHROPIC_API_KEY))
    if p == "gemini":
        return bool(_sanitize_secret_key(settings.GOOGLE_API_KEY))
    return False


_TASK_MODELS = {
    "generation": lambda: settings.GENERATION_MODEL,
    "evaluation": lambda: settings.EVALUATION_MODEL,
    "utterance": lambda: settings.UTTERANCE_MODEL,
}


def get_provider(task: str = "generation") -> LLMProvider:
    """
    Return the configured LLM provider for a given task.

    Provider is determined by LLM_PROVIDER in .env.
    """
    model = _TASK_MODELS.get(task, lambda: settings.GENERATION_MODEL)()
    provider = (settings.LLM_PROVIDER or "openai").strip().lower()

    if provider == "anthropic":
        akey = _sanitize_secret_key(settings.ANTHROPIC_API_KEY)
        if not akey:
            raise RuntimeError(
                "LLM_PROVIDER is anthropic but ANTHROPIC_API_KEY is empty. "
                "Either add an Anthropic API key, or set LLM_PROVIDER=openai (Railway Variables) "
                "and use OPENAI_API_KEY only."
            )
        return AnthropicProvider(api_key=akey, model=model)

    if provider == "gemini":
        from .gemini_provider import GeminiProvider

        gkey = _sanitize_secret_key(settings.GOOGLE_API_KEY)
        if not gkey:
            raise RuntimeError(
                "LLM_PROVIDER is gemini but GOOGLE_API_KEY is empty. "
                "Add a key from https://aistudio.google.com/apikey or set LLM_PROVIDER=openai."
            )
        return GeminiProvider(api_key=gkey, model=model)

    okey = _sanitize_secret_key(settings.OPENAI_API_KEY)
    if not okey:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to your server environment (e.g. Railway variables or server/.env)."
        )
    if _looks_like_dummy_openai_key(okey):
        raise RuntimeError(
            "OPENAI_API_KEY looks like a template (e.g. sk-placeholder). "
            "Set the real secret from https://platform.openai.com/api-keys on the Railway service "
            "that runs the API (Variables tab), redeploy, and avoid duplicate OPENAI variables."
        )
    return OpenAIProvider(api_key=okey, model=model)


def llm_config() -> dict:
    """Return the current LLM configuration for display purposes."""
    okey = _sanitize_secret_key(settings.OPENAI_API_KEY)
    akey = _sanitize_secret_key(settings.ANTHROPIC_API_KEY)
    gkey = _sanitize_secret_key(settings.GOOGLE_API_KEY)
    openai_ok = bool(okey) and not _looks_like_dummy_openai_key(okey)
    return {
        "provider": settings.LLM_PROVIDER,
        "generation_model": settings.GENERATION_MODEL,
        "evaluation_model": settings.EVALUATION_MODEL,
        "utterance_model": settings.UTTERANCE_MODEL,
        "openai_key_set": openai_ok,
        "anthropic_key_set": bool(akey),
        "gemini_key_set": bool(gkey),
    }
