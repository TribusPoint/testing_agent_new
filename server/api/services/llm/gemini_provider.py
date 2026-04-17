import asyncio

import google.generativeai as genai

from .base import LLMProvider


class GeminiProvider(LLMProvider):
    """Google Gemini (Generative Language API)."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self._api_key = api_key
        self._model = model

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(self, prompt: str, max_tokens: int, temperature: float = 0.7) -> str:
        def _run() -> str:
            genai.configure(api_key=self._api_key)
            model = genai.GenerativeModel(self._model)
            resp = model.generate_content(
                prompt,
                generation_config={
                    "max_output_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            text = (getattr(resp, "text", None) or "").strip()
            if not text and resp.candidates:
                parts = getattr(resp.candidates[0].content, "parts", None) or []
                text = "".join(getattr(p, "text", "") or "" for p in parts).strip()
            return text

        raw = await asyncio.to_thread(_run)
        return raw.replace("```json", "").replace("```", "").strip()
