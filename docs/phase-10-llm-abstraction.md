# Phase 10 — LLM Abstraction

**Status:** Done  
**Date:** April 2026  
**Author:** Testing Agent Team

---

## Overview

Phase 10 introduces a provider abstraction layer between the application logic and the underlying LLM APIs. Before this phase, all AI calls were hardcoded to OpenAI's GPT-4o. After this phase, the provider and model for each task can be changed with a single line in `.env` — no code changes required.

---

## Why This Matters

| Before | After |
|---|---|
| OpenAI GPT-4o hardcoded everywhere | Provider and model configurable per task |
| Switching provider = rewriting 3 files | Switching provider = edit `.env`, restart |
| One cost tier for all tasks | Use cheaper models for cheap tasks (utterances) |
| No path to Claude/Gemini | Anthropic Claude supported out of the box |

---

## Architecture

```
server/api/services/llm/
    __init__.py              re-exports get_provider()
    base.py                  Abstract LLMProvider class
    openai_provider.py       OpenAI implementation (GPT-4o, GPT-4o-mini, etc.)
    anthropic_provider.py    Anthropic implementation (Claude Sonnet, Haiku, etc.)
    factory.py               get_provider(task) → correct provider + model
```

### How the factory works

```
get_provider("generation")  → reads LLM_PROVIDER + GENERATION_MODEL from .env
get_provider("evaluation")  → reads LLM_PROVIDER + EVALUATION_MODEL from .env
get_provider("utterance")   → reads LLM_PROVIDER + UTTERANCE_MODEL from .env
```

Every service calls `get_provider(task).complete(prompt, max_tokens)` — it never imports OpenAI or Anthropic directly.

---

## Configuration (server/.env)

```env
# Which provider to use — "openai" or "anthropic"
LLM_PROVIDER=openai

# Model per task
GENERATION_MODEL=gpt-4o        # personas, dimensions, questions
EVALUATION_MODEL=gpt-4o        # LLM-as-judge scoring
UTTERANCE_MODEL=gpt-4o-mini    # follow-up utterances (cheaper)

# API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=             # leave blank if not using Anthropic
```

### New vars added to `server/config.py`

```python
# LLM routing
LLM_PROVIDER: str = "openai"          # "openai" | "anthropic"
GENERATION_MODEL: str = "gpt-4o"
EVALUATION_MODEL: str = "gpt-4o"
UTTERANCE_MODEL: str = "gpt-4o-mini"
```

### Task → service mapping

| Task name | Service file | What it does |
|---|---|---|
| `generation` | `openai_service.py` | Generates personas, dimensions, personality profiles, initiating questions |
| `evaluation` | `evaluation_service.py` | Scores agent responses 0–100 with rationale |
| `utterance` | `inspired_utterance.py` | Generates follow-up questions during a test run |

---

## New Files

### `server/api/services/llm/__init__.py`

```python
from .factory import get_provider

__all__ = ["get_provider"]
```

---

### `server/api/services/llm/base.py`

Abstract base class every provider must implement.

```python
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    All providers must implement `complete()`.
    """

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float = 0.7,
    ) -> str:
        """
        Send a single user prompt and return the text response.
        Raises on API errors — callers should handle exceptions.
        """
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable name, e.g. 'openai' or 'anthropic'."""
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """The specific model being used, e.g. 'gpt-4o'."""
        ...
```

---

### `server/api/services/llm/openai_provider.py`

```python
from openai import AsyncOpenAI
from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(self, prompt: str, max_tokens: int, temperature: float = 0.7) -> str:
        resp = await self._client.chat.completions.create(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.choices[0].message.content or ""
        return raw.strip().replace("```json", "").replace("```", "").strip()
```

---

### `server/api/services/llm/anthropic_provider.py`

```python
from anthropic import AsyncAnthropic
from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-3-5-sonnet-20241022"):
        self._client = AsyncAnthropic(api_key=api_key)
        self._model = model

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(self, prompt: str, max_tokens: int, temperature: float = 0.7) -> str:
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text if resp.content else ""
        return raw.strip().replace("```json", "").replace("```", "").strip()
```

---

### `server/api/services/llm/factory.py`

Routes each task to the correct provider and model based on `.env`.

```python
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
```

---

## Modified Files

### `server/api/services/openai_service.py` (key change)

**Before:**
```python
from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

async def _call(prompt: str, max_tokens: int) -> str:
    resp = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.choices[0].message.content.strip()
    return raw.replace("```json", "").replace("```", "").strip()
```

**After:**
```python
import json
from api.services.llm import get_provider

async def _call(prompt: str, max_tokens: int, temperature: float = 0.7) -> str:
    provider = get_provider("generation")
    return await provider.complete(prompt, max_tokens, temperature)
```

All generation functions (`generate_personas`, `generate_dimensions`, `generate_personality_profiles`, `generate_initiating_questions`) remain unchanged — they still call `_call()`. Only the `_call` implementation changed.

---

### `server/api/services/inspired_utterance.py` (key change)

**Before:**
```python
from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# ... inside get_inspired_utterance():
resp = await client.chat.completions.create(
    model="gpt-4o",
    max_tokens=500,
    messages=[{"role": "user", "content": prompt}],
)
raw = resp.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
```

**After:**
```python
import json
from api.services.llm import get_provider

# ... inside get_inspired_utterance():
provider = get_provider("utterance")
raw = await provider.complete(prompt, max_tokens=500, temperature=0.7)
```

Full file after change:

```python
import json
from api.services.llm import get_provider

_PROMPT = """You are simulating an evaluation persona with a specific personality profile,
interacting with an AI agent. Your goal is to get a clear, complete answer to the original
initiating question.

Review the conversation so far and determine:
1. Has the initiating question been fully answered?
2. If not, generate a natural follow-up utterance that moves toward getting that answer.

The utterance can be:
- A clarifying question about the agent's last response
- An answer to something the agent asked
- A restatement or rephrasing of the original question
- A request for more detail

Stay in character for the given persona and personality profile at all times."""


async def get_inspired_utterance(
    initiating_question: str,
    persona: str,
    personality_profile: str,
    conversation: list[dict],
) -> dict:
    conv_text = "\n".join([
        f"{'Persona' if m['role'] == 'user' else 'Agent'}: {m['text']}"
        for m in conversation
    ])

    prompt = f"""{_PROMPT}

Persona: {persona or "General"}
Personality profile: {personality_profile or "Neutral"}
Original Initiating Question: {initiating_question}

Conversation so far:
{conv_text}

First, determine: has the initiating question been fully answered?
Respond with a JSON object:
{{
  "answered": true or false,
  "utterance": "your next utterance in character as this persona (only if answered is false, otherwise empty string)"
}}

Respond ONLY with valid JSON, no markdown, no explanation."""

    provider = get_provider("utterance")
    raw = await provider.complete(prompt, max_tokens=500, temperature=0.7)
    result = json.loads(raw)
    return {"answered": result.get("answered", False), "utterance": result.get("utterance", "")}
```

---

### `server/api/services/evaluation_service.py` (key change)

**Before:**
```python
from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# ... inside evaluate_result():
resp = await client.chat.completions.create(
    model="gpt-4o",
    max_tokens=200,
    messages=[{"role": "user", "content": prompt}],
    temperature=0,
)
```

**After:**
```python
import json
from api.services.llm import get_provider

# ... inside evaluate_result():
provider = get_provider("evaluation")
raw = await provider.complete(prompt, max_tokens=200, temperature=0)
```

Full file after change:

```python
import json
from api.services.llm import get_provider

_JUDGE_PROMPT = """You are a QA evaluator assessing the quality of an AI agent's responses.

You will receive:
- The original test question (what the user wanted to know)
- Optionally, an expected answer (ground truth) to compare against
- The full conversation between the persona (user) and the agent

Your job: score the agent's overall performance on a scale of 0 to 100 and explain your
reasoning in ONE concise sentence.

Scoring guide (when NO expected answer is provided — opinion-based):
- 90-100: Perfect answer on first attempt, clear, accurate, complete
- 70-89: Good answer, mostly accurate, minor gaps or slight verbosity
- 50-69: Partial answer, correct direction but missing key info or unclear
- 25-49: Weak answer, incorrect or highly incomplete, may have required many follow-ups
- 0-24: Wrong, refused to answer, or completely off-topic

Scoring guide (when expected answer IS provided — ground-truth comparison):
- 90-100: Agent's answer matches expected answer fully and accurately
- 70-89: Agent's answer covers most key points of the expected answer
- 50-69: Agent's answer partially matches; some important points missing
- 25-49: Agent's answer diverges significantly from the expected answer
- 0-24: Agent's answer contradicts or completely misses the expected answer

Respond ONLY with valid JSON, no markdown:
{{"score": <integer 0-100>, "notes": "<one sentence rationale>"}}"""


async def evaluate_result(
    question: str,
    conversation: list[dict],
    expected_answer: str | None = None,
) -> dict:
    convo_text = "\n".join(
        f"{turn['role'].upper()}: {turn['text']}" for turn in conversation
    )
    expected_section = (
        f"\nExpected answer (ground truth):\n{expected_answer}\n"
        if expected_answer
        else "\n(No expected answer provided — use opinion-based scoring.)\n"
    )
    prompt = f"""{_JUDGE_PROMPT}

Original test question:
{question}
{expected_section}
Full conversation:
{convo_text}"""

    try:
        provider = get_provider("evaluation")
        raw = await provider.complete(prompt, max_tokens=200, temperature=0)
        data = json.loads(raw)
        return {
            "score": max(0, min(100, int(data.get("score", 50)))),
            "notes": str(data.get("notes", "")),
        }
    except Exception:
        return {"score": None, "notes": None}
```

---

### `server/main.py` — new `/api/config` endpoint added

```python
from api.services.llm.factory import llm_config

@app.get("/api/config")
async def get_config(_: str = Depends(verify_api_key)):
    return llm_config()
```

Response example:
```json
{
  "provider": "openai",
  "generation_model": "gpt-4o",
  "evaluation_model": "gpt-4o",
  "utterance_model": "gpt-4o-mini"
}
```

---

### `client/src/lib/api.ts` — new function added

```typescript
export const getLlmConfig = () =>
  req<{
    provider: string;
    generation_model: string;
    evaluation_model: string;
    utterance_model: string;
  }>("/api/config");
```

---

## Supported Providers

### OpenAI (`LLM_PROVIDER=openai`)

| Model | Recommended for |
|---|---|
| `gpt-4o` | Generation, Evaluation — highest quality |
| `gpt-4o-mini` | Utterances — lower cost, fast |

### Anthropic (`LLM_PROVIDER=anthropic`)

| Model | Recommended for |
|---|---|
| `claude-3-5-sonnet-20241022` | Generation, Evaluation — best quality |
| `claude-3-haiku-20240307` | Utterances — fastest and cheapest Claude |

---

## Switching to Anthropic

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)

2. Update `server/.env`:

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
GENERATION_MODEL=claude-3-5-sonnet-20241022
EVALUATION_MODEL=claude-3-5-sonnet-20241022
UTTERANCE_MODEL=claude-3-haiku-20240307
```

3. Restart the server:

```bash
cd server
uvicorn main:app --reload --port 8080
```

4. Open `http://localhost:3000/settings` — the **LLM Configuration** card confirms the active provider.

---

## Mixed-Provider Cost Strategy

```env
LLM_PROVIDER=openai
GENERATION_MODEL=gpt-4o        # ~$5/M tokens — one-time generation
EVALUATION_MODEL=gpt-4o        # ~$5/M tokens — accuracy matters
UTTERANCE_MODEL=gpt-4o-mini    # ~$0.15/M tokens — called up to 5× per question
```

For a run of 30 questions × 5 follow-ups, using `gpt-4o-mini` for utterances saves ~95% of utterance cost vs using `gpt-4o` everywhere.

---

## Adding a New Provider (Future)

To add Google Gemini:

1. Create `server/api/services/llm/gemini_provider.py`:

```python
import google.generativeai as genai
from .base import LLMProvider

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-pro"):
        genai.configure(api_key=api_key)
        self._model_name = model

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def complete(self, prompt: str, max_tokens: int, temperature: float = 0.7) -> str:
        model = genai.GenerativeModel(self._model_name)
        response = await model.generate_content_async(prompt)
        return response.text.strip()
```

2. In `factory.py`, add one branch:

```python
if provider == "gemini":
    return GeminiProvider(api_key=settings.GEMINI_API_KEY, model=model)
```

3. Add `GEMINI_API_KEY: str = ""` to `config.py` and `.env`.

No changes to any service file required.

---

## Running After Phase 10

```bash
# Install Anthropic SDK (one time, needed even if using OpenAI)
conda activate v1_env
pip install anthropic

# Start backend
cd server
uvicorn main:app --reload --port 8080

# Start frontend (separate terminal)
cd client
pnpm dev
```

Verify at `http://localhost:3000/settings` → **LLM Configuration** card shows current provider and models.
