import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, parse as parsePath } from 'path';
import type { DrevonConfig, DrevonMode, AgentId, IdentityConfig } from '../types.js';

const AgentIdEnum = z.enum([
  'copilot', 'claude', 'cursor', 'codex',
  'windsurf', 'cline', 'aider', 'continue',
  'gemini',
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
    layout: z.enum(['v1', 'v2']).optional(),
    indexFile: z.string().optional(),
    eagerBudgetTokens: z.number().optional(),
    retentionMonths: z.number().optional(),
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

/**
 * Walk up from startDir to find the nearest directory containing drevon.config.json.
 * Returns the project root directory, or throws if not found.
 */
export function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (configExists(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  throw new Error(
    `No drevon.config.json found in ${startDir} or any parent directory. Run "drevon init" first.`
  );
}

// v2 store: the eager index plus lazy topic files. The log lives in dated
// segments under log/ and is never listed here (never eagerly read).
const HUB_MEMORY_FILES: Record<string, string> = {
  index: '.drevon/memory/INDEX.md',
  user: '.drevon/memory/topics/user.md',
  projects: '.drevon/memory/topics/projects.md',
  systems: '.drevon/memory/topics/systems.md',
};

const PROJECT_MEMORY_FILES: Record<string, string> = {
  index: '.drevon/memory/INDEX.md',
  architecture: '.drevon/memory/topics/architecture.md',
  patterns: '.drevon/memory/topics/patterns.md',
};

// The memory protocol itself is emitted canonically by BaseAdapter.getMemoryProtocol();
// it is intentionally NOT duplicated as a config instruction. Migration strips any
// legacy `memory-protocol` instruction from existing configs.
const DEFAULT_HUB_INSTRUCTIONS = [
  {
    id: 'workspace-rules',
    title: 'Workspace Organization',
    alwaysApply: true,
    content:
      'All work happens inside `workspace/`. One folder per project or task.\n' +
      '- Name folders after the task (e.g., `workspace/landing-page/`)\n' +
      '- Never create files outside `workspace/` unless explicitly told\n' +
      '- Register new projects via `drevon memory learn "<project>" --topic projects`',
  },
];

const DEFAULT_PROJECT_INSTRUCTIONS: {
  id: string;
  title: string;
  alwaysApply?: boolean;
  content: string;
}[] = [];

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
    version: 2,
    mode,
    name,
    identity,
    instructions: mode === 'hub' ? DEFAULT_HUB_INSTRUCTIONS : DEFAULT_PROJECT_INSTRUCTIONS,
    agents: agentMap,
    memory: {
      enabled: true,
      directory: '.drevon/memory',
      files: mode === 'hub' ? { ...HUB_MEMORY_FILES } : { ...PROJECT_MEMORY_FILES },
      layout: 'v2',
      indexFile: '.drevon/memory/INDEX.md',
      eagerBudgetTokens: 2000,
      retentionMonths: 3,
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
