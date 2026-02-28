import type { AgentId } from '../types.js';
import { loadConfig, writeConfig } from '../core/config.js';
import { compile } from '../core/compiler.js';
import { getAllAgentIds, getAgentDisplayName } from '../adapters/registry.js';
import * as logger from '../utils/logger.js';

export async function addAgentCommand(name: string): Promise<void> {
  const cwd = process.cwd();

  const allAgents = getAllAgentIds();
  if (!allAgents.includes(name as AgentId)) {
    logger.error(`Unknown agent: ${name}. Available: ${allAgents.join(', ')}`);
    process.exit(1);
  }

  const agentId = name as AgentId;

  let config;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  if (config.agents[agentId]?.enabled) {
    logger.warn(`${getAgentDisplayName(agentId)} is already enabled.`);
    return;
  }

  config.agents[agentId] = { enabled: true };
  if (agentId === 'claude') {
    config.agents[agentId]!.allowedCommands = ['git', 'npm', 'npx', 'node', 'python3'];
  }

  writeConfig(cwd, config);
  logger.success(`Added ${getAgentDisplayName(agentId)} to config.`);

  const result = compile(cwd, config);
  for (const f of result.created) {
    logger.fileCreated(f);
  }
}
