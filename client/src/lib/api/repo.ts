import { req, del } from "./client";
import type { RepoQuestion, DomainCategoryInfo } from "./types";

export const listRepoQuestions = (params?: { domain?: string; category?: string; search?: string }) => {
  const qs = new URLSearchParams();
  if (params?.domain) qs.set("domain", params.domain);
  if (params?.category) qs.set("category", params.category);
  if (params?.search) qs.set("search", params.search);
  const suffix = qs.toString() ? `?${qs}` : "";
  return req<RepoQuestion[]>(`/api/repo/questions${suffix}`);
};

export const listRepoDomains = () =>
  req<DomainCategoryInfo[]>("/api/repo/questions/domains");

export const createRepoQuestion = (body: {
  question: string;
  expected_answer?: string | null;
  domain?: string;
  category?: string;
  tags?: string[];
}) => req<RepoQuestion>("/api/repo/questions", { method: "POST", body: JSON.stringify(body) });

export const updateRepoQuestion = (id: string, body: {
  question?: string;
  expected_answer?: string | null;
  domain?: string;
  category?: string;
  tags?: string[];
}) => req<RepoQuestion>(`/api/repo/questions/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteRepoQuestion = (id: string) => del(`/api/repo/questions/${id}`);

export const promoteToRepo = (body: {
  question_ids: string[];
  domain?: string;
  category?: string;
  tags?: string[];
}) => req<RepoQuestion[]>("/api/repo/questions/promote", { method: "POST", body: JSON.stringify(body) });
