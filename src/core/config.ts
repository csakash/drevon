import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DrevonConfig, DrevonMode, AgentId, IdentityConfig } from '../types.js';

const AgentIdEnum = z.enum([
  'copilot', 'claude', 'cursor', 'codex',
  'windsurf', 'cline', 'aider', 'continue',
]);

const IdentitySchema = z.object({
  role: z.string(),
  description: z.string(),
  posture: z.string(),
  capabilities: z.array(z.string()),
});

const InstructionSchema = z.object({
  id: z.string(),
  title: z.string(),
  alwaysApply: z.boolean().optional(),
  globs: z.array(z.string()).optional(),
  content: z.string(),
});

const AgentConfigSchema = z.object({
  enabled: z.boolean(),
  extraInstructions: z.string().optional(),
  allowedCommands: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const DrevonConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.number(),
  mode: z.enum(['hub', 'project']),
  name: z.string(),
  identity: IdentitySchema,
  instructions: z.array(InstructionSchema),
  agents: z.record(z.string(), AgentConfigSchema).default({}),
  memory: z.object({
    enabled: z.boolean(),
    directory: z.string(),
    files: z.record(z.string(), z.string()),
    customFiles: z.record(z.string(), z.string()).optional(),
  }),
  skills: z.object({
    enabled: z.boolean(),
    directory: z.string(),
    lockFile: z.string(),
    installed: z.array(z.string()).optional(),
  }),
  prompts: z.object({
    enabled: z.boolean(),
    directory: z.string(),
  }),
  workspace: z.object({
    enabled: z.boolean(),
    directory: z.string().optional(),
    rules: z.array(z.string()).optional(),
  }),
});

export function loadConfig(dir: string): DrevonConfig {
  const configPath = join(dir, 'drevon.config.json');
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}. Run "drevon init" first.`);
  }
  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  return DrevonConfigSchema.parse(raw) as DrevonConfig;
}

export function writeConfig(dir: string, config: DrevonConfig): void {
  const configPath = join(dir, 'drevon.config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function configExists(dir: string): boolean {
  return existsSync(join(dir, 'drevon.config.json'));
}

const HUB_MEMORY_FILES: Record<string, string> = {
  user: '.drevon/memory/user.md',
  projects: '.drevon/memory/projects.md',
  systems: '.drevon/memory/systems.md',
  log: '.drevon/memory/log.md',
};

const PROJECT_MEMORY_FILES: Record<string, string> = {
  context: '.drevon/memory/context.md',
  decisions: '.drevon/memory/decisions.md',
  patterns: '.drevon/memory/patterns.md',
  log: '.drevon/memory/log.md',
};

const DEFAULT_HUB_INSTRUCTIONS = [
  {
    id: 'memory-protocol',
    title: 'Memory Protocol',
    alwaysApply: true,
    content:
      'Read all files in .drevon/memory/ at the start of every session. Write to them after significant actions.\n\n' +
      '| File | Contains | When to update |\n' +
      '|------|----------|----------------|\n' +
      '| `.drevon/memory/user.md` | User preferences, feedback, decisions | When user expresses a preference |\n' +
      '| `.drevon/memory/projects.md` | Registry of all workspace projects | When a project is created/updated/completed |\n' +
      '| `.drevon/memory/systems.md` | Systems & infrastructure | When a new system is created or changed |\n' +
      '| `.drevon/memory/log.md` | Chronological action log | After every significant action |\n\n' +
      '### Write rules\n' +
      '- `log.md` — append only, newest at bottom, format: `### YYYY-MM-DD — title`\n' +
      '- `user.md` — update the relevant section in place\n' +
      '- `projects.md` / `systems.md` — update the relevant entry or add a new one\n' +
      '- Be specific and factual — memory should be useful to a future session with zero context',
  },
  {
    id: 'workspace-rules',
    title: 'Workspace Organization',
    alwaysApply: true,
    content:
      'All work happens inside `workspace/`. One folder per project or task.\n' +
      '- Name folders after the task (e.g., `workspace/landing-page/`)\n' +
      '- Never create files outside `workspace/` unless explicitly told\n' +
      '- Register new projects in `.drevon/memory/projects.md`',
  },
];

const DEFAULT_PROJECT_INSTRUCTIONS = [
  {
    id: 'memory-protocol',
    title: 'Memory Protocol',
    alwaysApply: true,
    content:
      'Read all files in .drevon/memory/ at the start of every session. Write to them after significant actions.\n\n' +
      '| File | Contains | When to update |\n' +
      '|------|----------|----------------|\n' +
      '| `.drevon/memory/context.md` | Project context, architecture, key files | When you learn new things about the codebase |\n' +
      '| `.drevon/memory/decisions.md` | Technical decisions & rationale | When a significant technical decision is made |\n' +
      '| `.drevon/memory/patterns.md` | Code patterns, conventions, gotchas | When patterns are discovered or established |\n' +
      '| `.drevon/memory/log.md` | Chronological action log | After every significant action |\n\n' +
      '### Write rules\n' +
      '- `log.md` — append only, newest at bottom, format: `### YYYY-MM-DD — title`\n' +
      '- `context.md` — update relevant sections in place as understanding grows\n' +
      '- `decisions.md` — append new decisions, format: `### Decision: [title]` with Date, Context, Decision, Rationale\n' +
      '- `patterns.md` — maintain as a living reference of code conventions\n' +
      '- Be specific and factual — memory should be useful to a future session with zero context',
  },
];

export function createDefaultConfig(
  mode: DrevonMode,
  name: string,
  identity: IdentityConfig,
  agents: AgentId[],
): DrevonConfig {
  const agentMap: Partial<Record<AgentId, { enabled: boolean; allowedCommands?: string[] }>> = {};
  for (const agent of agents) {
    agentMap[agent] = { enabled: true };
    if (agent === 'claude') {
      agentMap[agent]!.allowedCommands = ['git', 'npm', 'npx', 'node', 'python3'];
    }
  }

  return {
    $schema: 'https://drevon.dev/schema/v1.json',
    version: 1,
    mode,
    name,
    identity,
    instructions: mode === 'hub' ? DEFAULT_HUB_INSTRUCTIONS : DEFAULT_PROJECT_INSTRUCTIONS,
    agents: agentMap,
    memory: {
      enabled: true,
      directory: '.drevon/memory',
      files: mode === 'hub' ? { ...HUB_MEMORY_FILES } : { ...PROJECT_MEMORY_FILES },
    },
    skills: {
      enabled: true,
      directory: '.drevon/skills',
      lockFile: 'skills-lock.json',
    },
    prompts: {
      enabled: true,
      directory: '.drevon/prompts',
    },
    workspace: {
      enabled: mode === 'hub',
      directory: mode === 'hub' ? 'workspace' : undefined,
      rules:
        mode === 'hub'
          ? ['One folder per project', 'Never create files outside workspace/', 'Name folders after the task']
          : undefined,
    },
  };
}
