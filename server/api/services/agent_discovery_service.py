"""
Salesforce agent discovery, describe, and SOQL helpers.

Extracted from agents route to keep routes thin and services testable.
"""

import re
import httpx
from api.utils import normalize_salesforce_domain
from api.services.salesforce import get_token


def _strip_html(text: str, max_len: int = 300) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()[:max_len]


async def describe_sobject(
    domain: str, consumer_key: str, consumer_secret: str, sobject_name: str
) -> dict:
    sf_host = normalize_salesforce_domain(domain)
    if not sf_host:
        raise ValueError(
            "Salesforce domain is missing or invalid. Enter your org hostname only "
            "(e.g. mycompany.my.salesforce.com), without https://."
        )

    token = await get_token(domain, consumer_key, consumer_secret)
    headers = {"Authorization": f"Bearer {token}"}
    errors: list[str] = []

    for v in ["v62.0", "v61.0", "v60.0"]:
        for api_type in ["tooling", "data"]:
            base = f"https://{sf_host}/services/data/{v}"
            url = (
                f"{base}/tooling/sobjects/{sobject_name}/describe"
                if api_type == "tooling"
                else f"{base}/sobjects/{sobject_name}/describe"
            )
            try:
                async with httpx.AsyncClient(timeout=20) as c:
                    r = await c.get(url, headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    fields = [
                        {"name": f["name"], "label": f["label"], "type": f["type"]}
                        for f in data.get("fields", [])
                    ]
                    return {
                        "sobject": sobject_name,
                        "api": api_type,
                        "version": v,
                        "fields": fields,
                        "note": f"Retrieved via {api_type} API ({v})",
                    }
                errors.append(f"{api_type}/{v}: HTTP {r.status_code}")
            except Exception as exc:
                errors.append(f"{api_type}/{v}: {exc}")

    raise RuntimeError(f"Could not describe {sobject_name}. Tried: {'; '.join(errors)}")


async def discover_endpoints(
    domain: str, consumer_key: str, consumer_secret: str, agent_rows: list[dict]
) -> dict:
    sf_host = normalize_salesforce_domain(domain)
    if not sf_host:
        raise ValueError(
            "Salesforce domain is missing or invalid. Enter your org hostname only "
            "(e.g. mycompany.my.salesforce.com), without https://."
        )

    token = await get_token(domain, consumer_key, consumer_secret)
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    results: list[dict] = []

    async def probe(label: str, url: str, method: str = "GET", body: dict | None = None) -> dict:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                if method == "POST":
                    r = await c.post(url, json=body or {}, headers={**headers, "Content-Type": "application/json"})
                else:
                    r = await c.get(url, headers=headers)
            status = r.status_code
            try:
                data = r.json()
            except Exception:
                data = _strip_html(r.text)
            return {"label": label, "url": url, "status": status, "ok": status in (200, 201), "data": data}
        except Exception as ex:
            return {"label": label, "url": url, "status": 0, "ok": False, "data": str(ex)}

    r = await probe("API versions", f"https://{sf_host}/services/data/")
    results.append(r)
    latest_version = "v62.0"
    if r["ok"] and isinstance(r["data"], list):
        latest_version = r["data"][-1].get("version", "62.0")
        if not latest_version.startswith("v"):
            latest_version = f"v{latest_version}"

    results.append(await probe(f"REST resources ({latest_version})", f"https://{sf_host}/services/data/{latest_version}/"))
    results.append(await probe("AgentForce agents list (no prefix)", f"https://{sf_host}/einstein/ai-agent/v1/agents"))
    results.append(await probe(f"AgentForce agents list ({latest_version})", f"https://{sf_host}/services/data/{latest_version}/einstein/ai-agent/v1/agents"))

    for ag in agent_rows:
        for id_val in set([ag["salesforce_id"], ag.get("developer_name", "")]):
            if not id_val:
                continue
            results.append(await probe(
                f"Session create: {ag['name']} / {id_val} (POST, no prefix)",
                f"https://{sf_host}/einstein/ai-agent/v1/agents/{id_val}/sessions",
                method="POST",
            ))
            results.append(await probe(
                f"Session create: {ag['name']} / {id_val} (POST, {latest_version})",
                f"https://{sf_host}/services/data/{latest_version}/einstein/ai-agent/v1/agents/{id_val}/sessions",
                method="POST",
            ))

    results.append(await probe("MIAW conversations endpoint", f"https://{sf_host}/iamessage/api/v1/authorization/unauthenticated/access-token"))
    results.append(await probe("Identity (token info)", f"https://{sf_host}/services/oauth2/userinfo"))

    return {"domain": sf_host, "probes": results}


async def run_soql(domain: str, consumer_key: str, consumer_secret: str, query: str) -> dict:
    sf_host = normalize_salesforce_domain(domain)
    if not sf_host:
        raise ValueError(
            "Salesforce domain is missing or invalid. Enter your org hostname only "
            "(e.g. mycompany.my.salesforce.com), without https://."
        )

    token = await get_token(domain, consumer_key, consumer_secret)
    headers = {"Authorization": f"Bearer {token}"}

    for url in [
        f"https://{sf_host}/services/data/v62.0/tooling/query",
        f"https://{sf_host}/services/data/v61.0/tooling/query",
        f"https://{sf_host}/services/data/v60.0/tooling/query",
        f"https://{sf_host}/services/data/v62.0/query",
        f"https://{sf_host}/services/data/v61.0/query",
        f"https://{sf_host}/services/data/v60.0/query",
    ]:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(url, params={"q": query}, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {"ok": True, "endpoint": url, "totalSize": data.get("totalSize", 0), "records": data.get("records", [])}
            elif resp.status_code not in (400, 404):
                pass
            else:
                err = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else [{"message": _strip_html(resp.text, 400)}]
                if url.endswith("/tooling/query") and isinstance(err, list) and "not supported" in str(err).lower():
                    continue
                return {"ok": False, "endpoint": url, "error": err}
        except Exception:
            continue

    return {"ok": False, "error": "All endpoints failed", "endpoint": ""}


async def discover_runtime_ids(
    domain: str, consumer_key: str, consumer_secret: str, connection_type: str
) -> dict:
    if connection_type != "salesforce":
        return {
            "agents": [],
            "errors": [],
            "instructions": "Agent ID auto-discovery is only for Salesforce. Use + Add Page for Browser or HTTP agents.",
        }

    instructions = (
        "To find your agent ID manually: "
        "Salesforce Setup \u2192 search 'Agents' in Quick Find \u2192 "
        "click your agent \u2192 copy the 18-character ID from the URL "
        "(e.g. 0HoXXXXXXXXXXXXXXX) or the record detail page."
    )

    sf_host = normalize_salesforce_domain(domain)
    if not sf_host:
        return {
            "agents": [],
            "errors": [
                "Salesforce domain is missing or invalid. Use your org hostname only "
                "(e.g. mycompany.my.salesforce.com), without https://."
            ],
            "instructions": instructions,
        }

    token = await get_token(domain, consumer_key, consumer_secret)
    headers = {"Authorization": f"Bearer {token}"}
    results: list[dict] = []
    errors: list[str] = []

    async def _soql(q: str) -> list[dict] | None:
        for base in [
            f"https://{sf_host}/services/data/v62.0/tooling/query",
            f"https://{sf_host}/services/data/v61.0/tooling/query",
            f"https://{sf_host}/services/data/v60.0/tooling/query",
        ]:
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    r = await c.get(base, params={"q": q}, headers=headers)
                if r.status_code == 200:
                    return r.json().get("records", [])
            except Exception:
                pass
        return None

    async def _rest(q: str) -> list[dict] | None:
        for v in ["v62.0", "v61.0", "v60.0"]:
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    r = await c.get(f"https://{sf_host}/services/data/{v}/query", params={"q": q}, headers=headers)
                if r.status_code == 200:
                    return r.json().get("records", [])
            except Exception:
                pass
        return None

    rows = await _soql("SELECT Id,DeveloperName,MasterLabel FROM BotDefinition")
    if rows:
        results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "BotDefinition"} for r in rows]

    rows = await _soql("SELECT Id,DeveloperName,MasterLabel FROM GenAiPlanner")
    if rows:
        results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "GenAiPlanner"} for r in rows]

    if not results:
        rows = await _soql("SELECT Id,DeveloperName,MasterLabel FROM BotVersion")
        if rows:
            results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "BotVersion"} for r in rows]

    if not results:
        rows = await _rest("SELECT Id,DeveloperName,MasterLabel FROM GenAiPlanner")
        if rows:
            results += [{"id": r["Id"], "name": r["MasterLabel"], "developer_name": r["DeveloperName"], "source": "GenAiPlanner-REST"} for r in rows]

    if not results:
        for path in [
            "/einstein/ai-agent/v1/agents",
            "/services/data/v62.0/einstein/ai-agent/v1/agents",
            "/services/data/v61.0/einstein/ai-agent/v1/agents",
        ]:
            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    r = await c.get(f"https://{sf_host}{path}", headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    agents_raw = data.get("agents", data.get("records", []))
                    if agents_raw:
                        results += [
                            {
                                "id": a.get("agentId") or a.get("id") or a.get("Id", ""),
                                "name": a.get("agentName") or a.get("name") or a.get("MasterLabel", ""),
                                "developer_name": a.get("developerName") or a.get("DeveloperName", ""),
                                "source": f"runtime:{path}",
                            }
                            for a in agents_raw
                        ]
                        break
                else:
                    errors.append(f"{path}: {r.status_code} {_strip_html(r.text, 200)}")
            except Exception as e:
                errors.append(f"{path}: {e}")

    return {"agents": results, "errors": errors, "instructions": instructions}
