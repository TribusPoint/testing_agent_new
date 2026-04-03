import json
from api.services.llm import get_provider

_PROMPT = """You are simulating a tester with a specific persona and personality profile, interacting with an AI agent. Your goal is to get a clear, complete answer to the original initiating question.

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
        f"{'Tester' if m['role'] == 'user' else 'Agent'}: {m['text']}"
        for m in conversation
    ])

    prompt = f"""{_PROMPT}

Tester Persona: {persona or "General"}
Tester Personality Profile: {personality_profile or "Neutral"}
Original Initiating Question: {initiating_question}

Conversation so far:
{conv_text}

First, determine: has the initiating question been fully answered?
Respond with a JSON object:
{{
  "answered": true or false,
  "utterance": "your next utterance as the tester (only if answered is false, otherwise empty string)"
}}

Respond ONLY with valid JSON, no markdown, no explanation."""

    provider = get_provider("utterance")
    raw = await provider.complete(prompt, max_tokens=500, temperature=0.7)
    result = json.loads(raw)
    return {"answered": result.get("answered", False), "utterance": result.get("utterance", "")}
