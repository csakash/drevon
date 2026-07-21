// ── Core Types ──

export type DrevonMode = 'hub' | 'project';

export type AgentId =
  | 'copilot'
  | 'claude'
  | 'cursor'
  | 'codex'
  | 'windsurf'
  | 'cline'
  | 'aider'
  | 'continue';

export interface IdentityConfig {
  role: string;
  description: string;
  posture: string;
  capabilities: string[];
}

export interface Instruction {
  id: string;
  title: string;
  alwaysApply?: boolean;
  globs?: string[];
  content: string;
}

export interface AgentConfig {
  enabled: boolean;
  extraInstructions?: string;
  allowedCommands?: string[];
  config?: Record<string, unknown>;
}

export type MemoryLayout = 'v1' | 'v2';

export interface MemoryConfig {
  enabled: boolean;
  directory: string;
  files: Record<string, string>;
  customFiles?: Record<string, string>;
  /** Store layout. 'v1' = legacy monolithic files, 'v2' = index + lazy topics + log segments. */
  layout?: MemoryLayout;
  /** Relative path to the eagerly-read index file (v2 only). */
  indexFile?: string;
  /** Soft cap on the eager (index) load, in tokens. Governs INDEX.md trimming. */
  eagerBudgetTokens?: number;
  /** Log months kept as full segments before older ones roll into summaries. */
  retentionMonths?: number;
}

export interface SkillsConfig {
  enabled: boolean;
  directory: string;
  lockFile: string;
  installed?: string[];
}

export interface PromptsConfig {
  enabled: boolean;
  directory: string;
}

export interface WorkspaceConfig {
  enabled: boolean;
  directory?: string;
  rules?: string[];
}

export interface DrevonConfig {
  $schema?: string;
  version: number;
  mode: DrevonMode;
  name: string;
  identity: IdentityConfig;
  instructions: Instruction[];
  agents: Partial<Record<AgentId, AgentConfig>>;
  memory: MemoryConfig;
  skills: SkillsConfig;
  prompts: PromptsConfig;
  workspace: WorkspaceConfig;
}

export interface DiagnosticResult {
  file: string;
  status: 'ok' | 'missing' | 'stale' | 'error';
  message: string;
}

export interface InitOptions {
  mode: DrevonMode;
  name: string;
  identity: IdentityConfig;
  agents: AgentId[];
  enableMemory: boolean;
  enableSkills: boolean;
  enablePrompts: boolean;
  includeStarterPrompts: boolean;
  skillPack?: string;
  preset?: PresetName;
}

export type PresetName = 'founder' | 'developer' | 'team' | 'researcher';

export interface CompileResult {
  created: string[];
  updated: string[];
  unchanged: string[];
}

export interface CLIOptions {
  hub?: boolean;
  project?: boolean;
  yes?: boolean;
  agents?: string;
  memory?: boolean;
  skills?: boolean;
  template?: string;
}
