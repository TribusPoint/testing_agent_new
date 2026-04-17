import { req } from "./client";

export type LlmProviderId = "openai" | "anthropic" | "gemini";

export type LlmConfig = {
  provider: string;
  generation_model: string;
  evaluation_model: string;
  utterance_model: string;
  openai_key_set: boolean;
  anthropic_key_set: boolean;
  gemini_key_set: boolean;
};

export const getLlmConfig = () => req<LlmConfig>("/api/config");

export const updateLlmProvider = (provider: LlmProviderId) =>
  req<LlmConfig>("/api/config", {
    method: "PATCH",
    body: JSON.stringify({ provider }),
  });
