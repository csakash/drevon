import type { AgentId, DrevonConfig } from '../types.js';
import { BaseAdapter } from './base.js';
import { CopilotAdapter } from './copilot.js';
import { ClaudeCodeAdapter } from './claude.js';
import { CursorAdapter } from './cursor.js';
import { CodexAdapter } from './codex.js';
import { WindsurfAdapter } from './windsurf.js';
import { ClineAdapter } from './cline.js';
import { AiderAdapter } from './aider.js';
import { ContinueAdapter } from './continue.js';

const ADAPTER_MAP: Record<AgentId, new (config: DrevonConfig) => BaseAdapter> = {
  copilot: CopilotAdapter,
  claude: ClaudeCodeAdapter,
  cursor: CursorAdapter,
  codex: CodexAdapter,
  windsurf: WindsurfAdapter,
  cline: ClineAdapter,
  aider: AiderAdapter,
  continue: ContinueAdapter,
};

export function getAdapter(agentId: AgentId, config: DrevonConfig): BaseAdapter {
  const AdapterClass = ADAPTER_MAP[agentId];
  if (!AdapterClass) {
    throw new Error(`Unknown agent: ${agentId}`);
  }
  return new AdapterClass(config);
}

export function getAllAgentIds(): AgentId[] {
  return Object.keys(ADAPTER_MAP) as AgentId[];
}

export function getAgentDisplayName(agentId: AgentId): string {
  const names: Record<AgentId, string> = {
    copilot: 'GitHub Copilot',
    claude: 'Claude Code',
    cursor: 'Cursor',
    codex: 'OpenAI Codex CLI',
    windsurf: 'Windsurf',
    cline: 'Cline',
    aider: 'Aider',
    continue: 'Continue.dev',
  };
  return names[agentId] || agentId;
}
