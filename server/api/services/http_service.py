"""
Generic HTTP connector.

Sends a question to any REST API endpoint and extracts the text response
using a JSONPath-style dot-notation selector.

Agent config shape (stored in agents.config):
{
  "endpoint":      "https://api.example.com/chat",
  "method":        "POST",                         # default POST
  "body_template": "{\"message\": \"{{question}}\"}",  # {{question}} replaced
  "response_path": "reply.text",                   # dot-notation JSON path
  "extra_headers": {"X-Custom": "value"}           # merged with auth header
}

Connection config shape (stored in salesforce_connections.config):
{
  "auth_type":  "none" | "api_key" | "bearer" | "basic",
  "auth_header": "Authorization",                  # default
  "auth_value":  "Bearer sk-xxx"                   # full header value
}
"""

import json
import re
import httpx


class HttpServiceError(Exception):
    pass


def _build_headers(conn_config: dict) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    auth_type = (conn_config.get("auth_type") or "none").lower()
    if auth_type == "none":
        return headers
    header_name = conn_config.get("auth_header") or "Authorization"
    auth_value = conn_config.get("auth_value") or ""
    if auth_type == "bearer" and not auth_value.lower().startswith("bearer "):
        auth_value = f"Bearer {auth_value}"
    elif auth_type == "api_key":
        pass  # use auth_value as-is (user provides full value)
    headers[header_name] = auth_value
    return headers


def _build_body(template: str, question: str) -> dict:
    """Replace {{question}} in the template and parse as JSON."""
    filled = template.replace("{{question}}", question.replace('"', '\\"'))
    try:
        return json.loads(filled)
    except json.JSONDecodeError as e:
        raise HttpServiceError(f"Body template is not valid JSON after substitution: {e}\nTemplate: {filled}")


def _extract_response(data: dict | list, path: str) -> str:
    """
    Extract a value from a nested dict/list using dot-notation.
    Supports array indexing e.g. "messages.0.content" or "choices[0].message.content".
    """
    # Normalise bracket notation to dot notation: choices[0] -> choices.0
    path = re.sub(r"\[(\d+)\]", r".\1", path)
    parts = path.split(".")
    current = data
    for part in parts:
        if not part:
            continue
        try:
            if isinstance(current, list):
                current = current[int(part)]
            elif isinstance(current, dict):
                current = current[part]
            else:
                raise HttpServiceError(f"Cannot traverse '{part}' in {type(current).__name__}")
        except (KeyError, IndexError, ValueError) as e:
            raise HttpServiceError(
                f"Response path '{path}' failed at '{part}': {e}\n"
                f"Available keys: {list(current.keys()) if isinstance(current, dict) else f'list[{len(current)}]'}"
            )
    if isinstance(current, str):
        return current
    return json.dumps(current)


async def send_http_message(
    conn_config: dict,
    agent_config: dict,
    question: str,
    timeout: float = 30.0,
) -> str:
    """
    Send a question to a Generic HTTP agent and return the text response.

    Args:
        conn_config: Connection-level config (auth_type, auth_value, etc.)
        agent_config: Agent-level config (endpoint, method, body_template, response_path)
        question: The question text to send
        timeout: Request timeout in seconds
    """
    endpoint = (agent_config.get("endpoint") or "").strip()
    if not endpoint:
        raise HttpServiceError("Agent has no endpoint configured. Edit the agent and set the Endpoint URL.")

    method = (agent_config.get("method") or "POST").upper()
    body_template = agent_config.get("body_template") or '{"message": "{{question}}"}'
    response_path = (agent_config.get("response_path") or "").strip()
    extra_headers = agent_config.get("extra_headers") or {}

    headers = {**_build_headers(conn_config), **extra_headers}
    body = _build_body(body_template, question)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if method == "GET":
                resp = await client.get(endpoint, params={"message": question}, headers=headers)
            else:
                resp = await client.request(method, endpoint, json=body, headers=headers)
    except httpx.TimeoutException:
        raise HttpServiceError(f"Request timed out after {timeout}s")
    except httpx.RequestError as e:
        raise HttpServiceError(f"Connection error: {e}")

    if resp.status_code not in (200, 201):
        raise HttpServiceError(
            f"HTTP {resp.status_code}: {resp.text[:300]}"
        )

    try:
        data = resp.json()
    except Exception:
        # Plain text response
        return resp.text.strip() or "(empty response)"

    if not response_path:
        # No path specified — return the whole JSON as a string (user can refine later)
        return json.dumps(data)

    return _extract_response(data, response_path)


async def test_http_connection(conn_config: dict, endpoint: str) -> dict:
    """
    Verify that the endpoint is reachable and auth works.
    Sends a HEAD/GET request and returns status details.
    """
    headers = _build_headers(conn_config)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(endpoint, headers=headers)
        return {
            "success": resp.status_code < 500,
            "status_code": resp.status_code,
            "message": f"HTTP {resp.status_code} — endpoint is reachable",
        }
    except Exception as e:
        return {"success": False, "status_code": 0, "message": str(e)}
