// Browser probe
export interface ProbeCandidate {
  selector: string;
  score: number;
  count: number;
  placeholder?: string;
  text?: string;
  iframe?: string | null;
}
export interface ProbeResult {
  success: boolean;
  found_count?: number;
  url?: string;
  launcher_clicked?: string | null;
  error?: string;
  log?: string[];
  suggested?: {
    input_selector: string;
    send_selector: string;
    response_selector: string;
    iframe_selector: string;
    load_wait_ms: number;
    wait_after_send_ms: number;
  };
  candidates?: {
    input: ProbeCandidate[];
    send: ProbeCandidate[];
    response: ProbeCandidate[];
  };
  raw_dump?: Record<string, {
    inputs: Array<{ tag: string; attrs: Record<string, string>; rect: { w: number; h: number } }>;
    buttons: Array<{ tag: string; attrs: Record<string, string>; text: string; rect: { w: number; h: number } }>;
    iframe_sel: string | null;
  }>;
  screenshot_b64?: string | null;
}

// Connections
export interface HttpConnectionConfig {
  auth_type: "none" | "api_key" | "bearer" | "basic";
  auth_header?: string;
  auth_value?: string;
  test_url?: string;
}

export interface HttpAgentConfig {
  endpoint: string;
  method: string;
  body_template: string;
  response_path: string;
  extra_headers?: Record<string, string>;
}

export interface BrowserAgentConfig {
  url: string;
  input_selector: string;
  send_selector: string;
  response_selector: string;
  iframe_selector?: string;
  load_wait_ms?: number;
  wait_after_send_ms?: number;
  clear_input?: boolean;
}

export interface Connection {
  id: string;
  connection_type: string;
  name: string;
  domain: string;
  consumer_key: string;
  default_agent_id: string | null;
  config: HttpConnectionConfig | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionCreate {
  connection_type?: string;
  name: string;
  domain?: string;
  consumer_key?: string;
  consumer_secret?: string;
  config?: HttpConnectionConfig | null;
}

export interface Agent {
  id: string;
  connection_id: string;
  salesforce_id: string;
  name: string;
  developer_name: string;
  agent_type: string;
  runtime_url: string | null;
  config: HttpAgentConfig | BrowserAgentConfig | null;
  topics: { id: string; name: string; description: string }[];
  actions: { id: string; name: string }[];
  created_at: string;
  updated_at: string;
}

// Projects
export interface SiteAnalysisSubtitleTag {
  label: string;
  tone: string;
}

export interface SiteAnalysisTagged {
  text: string;
  tone: string;
  key: string;
}

export interface SiteAnalysis {
  overview_description: string;
  subtitle_tags: SiteAnalysisSubtitleTag[];
  audience_segments: SiteAnalysisTagged[];
  services: SiteAnalysisTagged[];
  keywords: string[];
  user_needs: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  company_name: string | null;
  company_websites: string | null;
  industry: string | null;
  competitors: string | null;
  site_analysis?: SiteAnalysis | null;
  site_analyzed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  company_name?: string;
  company_websites?: string;
  industry?: string;
  competitors?: string;
}

export interface Persona {
  id: string;
  project_id: string;
  agent_id: string | null;
  name: string;
  description: string | null;
  tag: string | null;
  goal?: string | null;
  personality?: string | null;
  knowledge_level?: string | null;
}

export interface DimensionValue {
  id: string;
  dimension_id: string;
  name: string;
  description: string | null;
}

export interface Dimension {
  id: string;
  project_id: string;
  name: string;
  values: DimensionValue[];
}

export interface PersonalityProfile {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
}

export interface Question {
  id: string;
  project_id: string;
  agent_id: string | null;
  question: string;
  expected_answer: string | null;
  persona: string | null;
  dimension: string | null;
  dimension_value: string | null;
  personality_profile: string | null;
}

// Runs
export interface Run {
  id: string;
  project_id: string;
  agent_id: string;
  status: string;
  total_questions: number;
  completed_questions: number;
  started_at: string | null;
  completed_at: string | null;
  last_error?: string | null;
}

export interface RunResult {
  id: string;
  run_id: string;
  question_id: string | null;
  question_text: string;
  response_text: string | null;
  follow_up_utterances: { utterance: string; response: string }[];
  latency_ms: number | null;
  answered: boolean | null;
  score: number | null;
  evaluation_notes: string | null;
  human_score: number | null;
  human_notes: string | null;
  status: string;
}

export interface RunComparison {
  run_a: string;
  run_b: string;
  avg_score_a: number | null;
  avg_score_b: number | null;
  avg_delta: number | null;
  questions: {
    question_id: string | null;
    question_text: string;
    score_a: number | null;
    score_b: number | null;
    delta: number | null;
  }[];
}

export interface RunReport {
  run_id: string;
  status: string;
  total_results: number;
  completed_results: number;
  pass_count: number;
  pass_rate: number;
  avg_score: number | null;
  avg_latency_ms: number | null;
  score_distribution: {
    bucket_0_25: number;
    bucket_26_50: number;
    bucket_51_75: number;
    bucket_76_100: number;
  };
}

// Auth / Settings
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  must_change_password?: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export interface MessageResponse {
  message: string;
}

export interface PasswordResetInfo {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  status: string;
  created_at: string;
}

// Dashboard
export interface DashboardSummary {
  total_runs: number;
  completed_runs: number;
  total_questions_tested: number;
  overall_avg_score: number | null;
  overall_pass_rate: number | null;
  agents_count: number;
  projects_count: number;
}

export interface AgentOption {
  id: string;
  name: string;
}

export interface TrendPoint {
  run_id: string;
  run_short: string;
  completed_at: string | null;
  avg_score: number | null;
  pass_rate: number | null;
  completed_questions: number;
}

export interface AgentTrend {
  agent_id: string;
  agent_name: string;
  runs: TrendPoint[];
}

export interface WeakQuestion {
  question_text: string;
  avg_score: number | null;
  min_score: number | null;
  max_score: number | null;
  run_count: number;
  pass_rate: number | null;
}

// Failure analysis
export interface FailureBreakdown {
  name: string;
  total: number;
  failed: number;
  failure_rate: number;
}

export interface DimensionFailure {
  dimension: string;
  value: string;
  total: number;
  failed: number;
  failure_rate: number;
}

export interface AgentFailure {
  agent_id: string;
  agent_name: string;
  total: number;
  failed: number;
  failure_rate: number;
  avg_score: number | null;
}

export interface HeatmapCell {
  personality: string;
  dimension: string;
  total: number;
  failed: number;
  failure_rate: number;
}

// Questions Repository
export interface RepoQuestion {
  id: string;
  question: string;
  expected_answer: string | null;
  domain: string;
  category: string;
  tags: string[];
  source_project_id: string | null;
  persona: string | null;
  dimension: string | null;
  dimension_value: string | null;
  personality_profile: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainCategoryInfo {
  domain: string;
  categories: string[];
  count: number;
}
