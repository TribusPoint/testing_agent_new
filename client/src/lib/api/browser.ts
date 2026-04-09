import { req } from "./client";
import type { ProbeResult } from "./types";

export const probeBrowserUrl = (url: string) =>
  req<ProbeResult>("/api/browser/probe", { method: "POST", body: JSON.stringify({ url }) });
