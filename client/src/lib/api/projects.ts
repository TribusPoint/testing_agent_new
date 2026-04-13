import { req, del } from "./client";
import type { Project, ProjectCreate, Persona, Dimension, PersonalityProfile, Question } from "./types";

export const listProjects = () => req<Project[]>("/api/projects");
export const getProject = (id: string) => req<Project>(`/api/projects/${id}`);

export const createProject = (b: ProjectCreate) =>
  req<Project>("/api/projects", { method: "POST", body: JSON.stringify(b) });

export const updateProject = (
  id: string,
  body: { name?: string; description?: string; company_name?: string; industry?: string; competitors?: string; company_websites?: string }
) => req<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const deleteProject = (id: string) => del(`/api/projects/${id}`);

export const analyzeProjectSite = (projectId: string, body: { url?: string | null } = {}) =>
  req<Project>(`/api/projects/${projectId}/analyze-site`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// Generate
export const generatePersonas = (projectId: string, agentId: string, count = 4) =>
  req<Persona[]>(`/api/projects/${projectId}/generate/personas`, {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId || null, count }),
  });

export const generateDimensions = (projectId: string) =>
  req<Dimension[]>(`/api/projects/${projectId}/generate/dimensions`, { method: "POST", body: "{}" });

export const generateProfiles = (projectId: string) =>
  req<PersonalityProfile[]>(`/api/projects/${projectId}/generate/personality-profiles`, { method: "POST", body: "{}" });

export const generateQuestions = (projectId: string, perPersona = 3) =>
  req<Question[]>(`/api/projects/${projectId}/generate/questions`, {
    method: "POST",
    body: JSON.stringify({ questions_per_persona: perPersona }),
  });

// Context data
export const listPersonas = (projectId: string) =>
  req<Persona[]>(`/api/projects/${projectId}/personas`);

export const createPersona = (
  projectId: string,
  body: {
    name: string;
    description?: string | null;
    goal?: string | null;
    personality?: string | null;
    knowledge_level?: string | null;
    tag?: string | null;
    agent_id?: string | null;
  }
) =>
  req<Persona>(`/api/projects/${projectId}/personas`, { method: "POST", body: JSON.stringify(body) });

export const updatePersona = (
  projectId: string,
  personaId: string,
  body: {
    name?: string;
    description?: string | null;
    goal?: string | null;
    personality?: string | null;
    knowledge_level?: string | null;
    tag?: string | null;
  }
) =>
  req<Persona>(`/api/projects/${projectId}/personas/${personaId}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteAllPersonas = (projectId: string) =>
  del(`/api/projects/${projectId}/personas`);

export const deletePersona = (projectId: string, personaId: string) =>
  del(`/api/projects/${projectId}/personas/${personaId}`);

export const listDimensions = (projectId: string) =>
  req<Dimension[]>(`/api/projects/${projectId}/dimensions`);

export const listProfiles = (projectId: string) =>
  req<PersonalityProfile[]>(`/api/projects/${projectId}/personality-profiles`);

export const listQuestions = (projectId: string) =>
  req<Question[]>(`/api/projects/${projectId}/questions`);

export const updateQuestion = (projectId: string, questionId: string, body: { expected_answer: string | null }) =>
  req<Question>(`/api/projects/${projectId}/questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
