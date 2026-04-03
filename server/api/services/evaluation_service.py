import json
from api.services.llm import get_provider

_JUDGE_PROMPT = """You are a QA evaluator assessing the quality of an AI agent's responses.

You will receive:
- The original test question (what the user wanted to know)
- Optionally, an expected answer (ground truth) to compare against
- The full conversation between tester and agent

Your job: score the agent's overall performance on a scale of 0 to 100 and explain your reasoning in ONE concise sentence.

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
    """
    Evaluate a completed conversation and return {"score": int, "notes": str}.
    conversation is a list of {"role": "user"|"agent", "text": "..."} dicts.
    When expected_answer is provided, scoring is grounded against it.
    """
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
