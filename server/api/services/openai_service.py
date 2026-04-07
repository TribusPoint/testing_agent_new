import json
from api.services.llm import get_provider

_PERSONA_PROMPT = """You are helping design evaluation personas for an AI agent evaluation suite.
For each persona provide realistic, distinct profiles suitable for testing chat or support agents."""

_DIMENSION_NAMES_PROMPT = """Create 2 dimensions, one called General Info, another called Program Types."""

_DIMENSION_VALUES_PROMPT = """For General Info, combine all that you know about the company in Background Context Gathering, look through all the competitors mentioned, and give me a big list of General Info topics for the industry, not just for the company, but for the industry. In other words, general info types for the company itself, plus general info types of the competitors mentioned by name, plus just the generic general info types the industry in general has. When the Industry is Education, general info topics are things like Campus Location, Accreditation Status, opening hours, email address for support etc.
For program type, they are things like graduate programs, bachelors, online degrees etc. In other words, things related to the type of degrees or academic programs (but not the actual subjects themselves."""

_PRODUCTS_PROMPT = """Combine all that you know about the company in Background Context Gathering, look through all the competitors mentioned, and give me a big list of product categories for the industry, not just for the company, but for the industry. In other words, product categories for the company itself, plus product categories of the competitors mentioned by name, plus just the generic product categories the industry in general has. When the Industry is Education, make the majors / academic topics the product categories. In other words, don't make "graduate program" or "undergraduate program" the product list here; instead they should be things like "physics", "computer science" etc - the actual study subjects."""

_PROFILES_PROMPT = """Create a list of personality types that shape how questions are phrased when paired with a persona. For example: aggressive, friendly, needs lots of detail, prefers basics only, highly knowledgeable, etc. Use your imagination."""

_QUESTIONS_PROMPT = """For each agent there is, first randomly select an evaluation persona, then randomly select an 'initiating question dimension' and then randomly select a dimension value for the selected dimension, then randomly pick a personality profile. Combining the persona, the initiating question dimension and a dimension value, and the personality profile, generate an 'Initiating Question'. For each agent, generate 30 of such initiating questions. In essence, the idea is that you ask the question as if you are that persona, about the dimension and dimension value, in a manner and with wording based on the personality profile."""


async def _call(prompt: str, max_tokens: int, temperature: float = 0.7) -> str:
    provider = get_provider("generation")
    return await provider.complete(prompt, max_tokens, temperature)


async def generate_personas(
    company_name: str,
    company_websites: str,
    industry: str,
    competitors: str,
    agent_name: str,
    topics: list,
    actions: list,
    count: int = 4,
) -> list[dict]:
    topics_text = "\n".join([f"- {t['name']}: {t.get('description','')}" for t in topics]) or "Not specified"
    actions_text = "\n".join([f"- {a['name']}: {a.get('description','')}" for a in actions]) or "Not specified"

    agent_section = (
        f'\nThis agent is called "{agent_name}" and handles these topics:\n{topics_text}\n\nWith these actions:\n{actions_text}'
        if topics or actions
        else f"Generate personas for a company in the {industry or 'given'} industry based on the context below."
    )

    n = max(1, min(count, 12))
    prompt = f"""{_PERSONA_PROMPT}

Generate exactly {n} personas.

Company context:
- Company Name: {company_name or "Not specified"}
- Industry: {industry or "Not specified"}
- Websites: {company_websites or "Not specified"}
- Competitors: {competitors or "Not specified"}
{agent_section}

For each persona use a realistic display name (e.g. "Emily Johnson", "Dr. Michael Stevens").

Respond ONLY with a valid JSON array, no markdown, no explanation. Format:
[
  {{
    "name": "Full display name",
    "persona": "One-line role (who they are, e.g. Patients seeking specialist appointments)",
    "goal": "First-person goal sentence (what they want from the agent)",
    "personality": "Communication style (e.g. Casual and friendly, Formal and professional)",
    "knowledge_level": "e.g. Beginner, Expert, Good business knowledge",
    "tag": "internal|external"
  }},
  ...
]"""
    raw = await _call(prompt, 2500)
    rows = json.loads(raw)
    # Normalize legacy shape {name, description, tag} → new fields
    out = []
    for p in rows:
        if "persona" in p or "goal" in p:
            out.append({
                "name": p.get("name", "Unnamed persona"),
                "persona": p.get("persona") or p.get("description"),
                "goal": p.get("goal"),
                "personality": p.get("personality"),
                "knowledge_level": p.get("knowledge_level"),
                "tag": p.get("tag"),
            })
        else:
            out.append({
                "name": p.get("name", "Unnamed persona"),
                "persona": p.get("description"),
                "goal": None,
                "personality": None,
                "knowledge_level": None,
                "tag": p.get("tag"),
            })
    return out


async def generate_dimensions(
    company_name: str,
    company_websites: str,
    industry: str,
    competitors: str,
) -> dict[str, list[dict]]:
    context = f"""Company context:
- Company Name: {company_name or "Not specified"}
- Industry: {industry or "Not specified"}
- Websites: {company_websites or "Not specified"}
- Competitors: {competitors or "Not specified"}"""

    dim_prompt = f"""{_DIMENSION_NAMES_PROMPT}

{context}

Respond ONLY with a valid JSON array of dimension names, no markdown, no explanation. Format:
["Dimension Name 1", "Dimension Name 2", ...]"""
    raw = await _call(dim_prompt, 200)
    dimension_names: list[str] = json.loads(raw)

    results: dict[str, list[dict]] = {}

    for dim in dimension_names:
        val_prompt = f"""{_DIMENSION_VALUES_PROMPT}

{context}

You are generating values specifically for the dimension: "{dim}"
Make a unique list within this dimension. Generate a description for each value.
Respond ONLY with a valid JSON array, no markdown, no explanation. Format:
[
  {{"name": "...", "description": "..."}},
  ...
]"""
        try:
            raw2 = await _call(val_prompt, 2000)
            results[dim] = json.loads(raw2)
        except Exception:
            results[dim] = []

    prod_prompt = f"""{_PRODUCTS_PROMPT}

{context}

Make a unique list. Generate a description for each product category.
Respond ONLY with a valid JSON array, no markdown, no explanation. Format:
[
  {{"name": "...", "description": "..."}},
  ...
]"""
    try:
        raw3 = await _call(prod_prompt, 2000)
        results["Products / Services"] = json.loads(raw3)
    except Exception:
        results["Products / Services"] = []

    return results


async def generate_personality_profiles() -> list[dict]:
    prompt = f"""{_PROFILES_PROMPT}

Generate a list of 6-10 distinct personality profiles. For each profile provide:
1. A short name (e.g. "Aggressive", "Detail-oriented")
2. A 1-2 sentence description of how this personality type interacts and what makes it distinctive when phrasing questions

Make sure the profiles are meaningfully different from each other.
Respond ONLY with a valid JSON array, no markdown, no explanation. Format:
[
  {{"name": "...", "description": "..."}},
  ...
]"""
    raw = await _call(prompt, 1500)
    return json.loads(raw)


async def generate_initiating_questions(
    company_name: str,
    industry: str,
    agent_name: str,
    personas: list[str],
    dim_values: list[dict],
    profile_names: list[str],
    questions_per_agent: int = 30,
) -> list[dict]:
    prompt = f"""{_QUESTIONS_PROMPT}

Company: {company_name or "Not specified"}, Industry: {industry or "Not specified"}
Agent: {agent_name}

IMPORTANT: You MUST select ONLY from the exact values provided below.

Evaluation personas (pick ONLY from this list):
{json.dumps(personas)}

Exact list of Dimensions and Dimension Values (pick ONLY from this list):
{json.dumps(dim_values)}

Exact list of personality profiles (pick ONLY from this list):
{json.dumps(profile_names)}

Instructions — follow this exact order for each question:
1. Randomly pick one persona from the Evaluation personas list.
2. Randomly pick one dimension+value pair from the Dimension Values list.
3. Randomly pick one personality profile from the Personality Profiles list.
4. Generate the question — written as if the chosen persona is asking about the chosen dimension value, in the tone and style of the chosen personality profile.
5. Record the exact persona name, dimension name, dimension value, and personality profile used.
6. Repeat til you have exactly {questions_per_agent} questions.

The "persona", "dimension", "dimensionValue", and "personalityProfile" fields MUST be the exact values selected — character for character.

Respond ONLY with a valid JSON array, no markdown, no explanation. Format:
[
  {{
    "question": "...",
    "persona": "<exact persona name>",
    "dimension": "<exact dimension name>",
    "dimensionValue": "<exact dimension value name>",
    "personalityProfile": "<exact profile name>"
  }},
  ...
]"""
    raw = await _call(prompt, 16000)
    if not raw.endswith("]"):
        last = raw.rfind("},")
        if last > 0:
            raw = raw[:last + 1] + "]"
    return json.loads(raw)
