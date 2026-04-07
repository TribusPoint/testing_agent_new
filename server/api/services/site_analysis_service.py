"""
Fetch a public URL, extract readable text, and ask the LLM for a structured
site analysis (audience, services, keywords, user needs) for the project UI.
"""

import json
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from api.services.llm import get_provider

_MAX_TEXT_CHARS = 14_000
_FETCH_TIMEOUT = 25.0

_TONE_CYCLE = (
    "blue",
    "emerald",
    "orange",
    "purple",
    "rose",
    "cyan",
    "amber",
    "pink",
    "indigo",
    "teal",
    "violet",
    "sky",
)


def extract_primary_url(websites: str | None) -> str | None:
    """Pick first plausible URL from free-form project websites field."""
    if not websites or not str(websites).strip():
        return None
    raw = str(websites).strip()
    for part in re.split(r"[\s,;|]+", raw):
        p = part.strip()
        if not p:
            continue
        if p.startswith(("http://", "https://")):
            try:
                urlparse(p)
                return p
            except Exception:
                continue
        if "." in p and " " not in p and "/" not in p.replace(".", ""):
            return "https://" + p.lstrip("/")
    return None


def _normalize_url(url: str) -> str:
    u = url.strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    parsed = urlparse(u)
    if not parsed.netloc:
        raise ValueError("Invalid URL")
    return u


async def fetch_page_text(url: str) -> str:
    """GET URL and return plain text (truncated)."""
    final_url = _normalize_url(url)
    headers = {
        "User-Agent": "TestingAgentSiteAnalyzer/1.0 (+https://github.com/testing-agent)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    }
    try:
        async with httpx.AsyncClient(
            timeout=_FETCH_TIMEOUT,
            follow_redirects=True,
            headers=headers,
        ) as client:
            resp = await client.get(final_url)
            resp.raise_for_status()
            ctype = resp.headers.get("content-type", "")
            if "html" not in ctype.lower() and "text" not in ctype.lower():
                raise ValueError(f"Unsupported content type: {ctype or 'unknown'}")
            html = resp.text
    except httpx.InvalidURL as e:
        raise ValueError(f"Invalid website URL: {url!r}") from e
    except httpx.ConnectError as e:
        err = str(e).lower()
        typo_hint = ""
        if "name or service not known" in err or "nodename nor servname" in err:
            typo_hint = (
                " If the site works in your browser, verify the hostname spelling "
                "(typos like standford vs stanford cause DNS failures). "
            )
        raise ValueError(
            f"Could not reach {final_url} (DNS or network).{typo_hint}"
            "Use a public https URL with a resolvable hostname—not localhost or an internal name. "
            f"Details: {e!s}"
        ) from e
    except httpx.TimeoutException as e:
        raise ValueError(f"Timed out fetching {final_url}: {e!s}") from e
    except httpx.HTTPStatusError as e:
        raise ValueError(
            f"Website returned HTTP {e.response.status_code} for {final_url}"
        ) from e

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "template"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = text.strip()
    if len(text) > _MAX_TEXT_CHARS:
        text = text[:_MAX_TEXT_CHARS] + "\n\n[…truncated for analysis…]"
    if len(text) < 80:
        raise ValueError("Not enough text extracted from the page")
    return text


def _assign_tones(items: list[str], key: str) -> list[dict]:
    out = []
    for i, line in enumerate(items):
        tone = _TONE_CYCLE[i % len(_TONE_CYCLE)]
        out.append({"text": line, "tone": tone, "key": f"{key}-{i}"})
    return out


_ANALYSIS_PROMPT = """You analyze public website content for QA / agent-testing projects.

You will receive:
- Organization name and industry (may be partial)
- Plain text extracted from their main website (homepage or landing page)

Respond ONLY with valid JSON (no markdown). Use this exact shape:
{
  "overview_description": "3-5 sentences summarizing who they are and what the site offers.",
  "subtitle_tags": [
    {"label": "Short label e.g. industry type", "tone": "blue"},
    {"label": "Second label e.g. org type", "tone": "slate"}
  ],
  "audience_segments": [
    "First audience in short phrase",
    "… 6 to 12 distinct audience segments …"
  ],
  "services": [
    "Concrete service or product area visible on the site",
    "… 8 to 14 services …"
  ],
  "keywords": [
    "brand-relevant or SEO-style keyword",
    "… 10 to 16 keywords …"
  ],
  "user_needs": [
    "What a visitor likely wants to accomplish, as a short phrase",
    "… 8 to 12 user needs …"
  ]
}

Rules:
- Base everything ONLY on the provided page text and org hints; if unknown, infer cautiously and say so in overview.
- subtitle_tags: exactly 2 items when possible; tone must be one of: blue, slate, emerald, orange, purple.
- audience_segments, services, keywords, user_needs: plain strings in arrays (no nested objects).
- Be specific to this organization, not generic filler.
"""


async def analyze_site_with_llm(
    *,
    page_text: str,
    company_name: str | None,
    industry: str | None,
    project_name: str,
) -> dict:
    provider = get_provider("generation")
    context = f"""Organization hints:
- Project name: {project_name}
- Company name: {company_name or "unknown"}
- Industry: {industry or "unknown"}

--- Page text ---
{page_text}
--- End page text ---
"""
    prompt = f"{_ANALYSIS_PROMPT}\n\n{context}"
    raw = await provider.complete(prompt, max_tokens=3500, temperature=0.4)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    data = json.loads(raw)

    # Normalize to UI-ready structure with stable tone assignment
    aud = [str(x).strip() for x in data.get("audience_segments") or [] if str(x).strip()]
    svc = [str(x).strip() for x in data.get("services") or [] if str(x).strip()]
    kws = [str(x).strip() for x in data.get("keywords") or [] if str(x).strip()]
    needs = [str(x).strip() for x in data.get("user_needs") or [] if str(x).strip()]

    subtitle = data.get("subtitle_tags") or []
    norm_sub = []
    for i, item in enumerate(subtitle[:4]):
        if isinstance(item, dict):
            lab = str(item.get("label", "")).strip()
            tone = str(item.get("tone", "blue")).strip() or "blue"
        else:
            lab = str(item).strip()
            tone = _TONE_CYCLE[i % len(_TONE_CYCLE)]
        if lab:
            norm_sub.append({"label": lab, "tone": tone})

    return {
        "overview_description": str(data.get("overview_description", "")).strip()
        or "No overview could be generated.",
        "subtitle_tags": norm_sub,
        "audience_segments": _assign_tones(aud, "aud"),
        "services": _assign_tones(svc, "svc"),
        "keywords": kws,
        "user_needs": needs,
    }


async def run_site_analysis_for_project(
    *,
    url: str,
    company_name: str | None,
    industry: str | None,
    project_name: str,
) -> dict:
    text = await fetch_page_text(url)
    return await analyze_site_with_llm(
        page_text=text,
        company_name=company_name,
        industry=industry,
        project_name=project_name,
    )
