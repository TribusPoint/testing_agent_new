// Core domain types shared between server and client.
// These mirror the Drizzle schema defined in Phase 2.

export interface AgentConfig {
  id: string;
  orgId: string;
  name: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  tools: ToolDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface TestScenario {
  id: string;
  orgId: string;
  name: string;
  description: string;
  agentAId: string;
  agentBId: string;
  maxTurns: number;
  stopPhrases: string[];
  createdAt: Date;
}

export type TestRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TestRun {
  id: string;
  orgId: string;
  scenarioId: string;
  status: TestRunStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ConversationTurn {
  id: string;
  runId: string;
  turnIndex: number;
  agentId: string;
  role: MessageRole;
  content: string;
  toolCalls: ToolCall[] | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: unknown | null;
}
