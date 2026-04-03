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
