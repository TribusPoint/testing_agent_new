import { req, BASE } from "./client";
import type { ApiKeyInfo, ApiKeyCreated } from "./types";

export type LlmConfig = {
  provider: string;
  generation_model: string;
  evaluation_model: string;
  utterance_model: string;
  openai_key_set: boolean;
  anthropic_key_set: boolean;
};

export const getLlmConfig = () => req<LlmConfig>("/api/config");

export const updateLlmProvider = (provider: "openai" | "anthropic") =>
  req<LlmConfig>("/api/config", {
    method: "PATCH",
    body: JSON.stringify({ provider }),
  });

export const verifyKey = (key: string) =>
  fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? "Invalid key");
    return body as { valid: boolean; name: string };
  });

export const createApiKey = (name: string, masterKey: string) =>
  fetch(`${BASE}/api/auth/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": masterKey },
    body: JSON.stringify({ name }),
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? "Failed");
    return body as ApiKeyCreated;
  });

export const listApiKeys = (masterKey: string) =>
  fetch(`${BASE}/api/auth/keys`, {
    headers: { "X-API-Key": masterKey },
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? "Failed");
    return body as ApiKeyInfo[];
  });

export const revokeApiKey = (id: string, masterKey: string) =>
  fetch(`${BASE}/api/auth/keys/${id}`, {
    method: "DELETE",
    headers: { "X-API-Key": masterKey },
  });

export const reactivateApiKey = (id: string, masterKey: string) =>
  fetch(`${BASE}/api/auth/keys/${id}/reactivate`, {
    method: "PATCH",
    headers: { "X-API-Key": masterKey },
  }).then(async (r) => {
    const body = await r.json();
    if (!r.ok) throw new Error(body.detail ?? "Failed");
    return body as ApiKeyInfo;
  });

export const deleteApiKeyPermanently = (id: string, masterKey: string) =>
  fetch(`${BASE}/api/auth/keys/${id}/permanent`, {
    method: "DELETE",
    headers: { "X-API-Key": masterKey },
  });
