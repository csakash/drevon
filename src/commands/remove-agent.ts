import type { AgentId } from '../types.js';
import { loadConfig, writeConfig } from '../core/config.js';
import { getAdapter, getAllAgentIds, getAgentDisplayName } from '../adapters/registry.js';
import * as logger from '../utils/logger.js';

export async function removeAgentCommand(name: string): Promise<void> {
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

  if (!config.agents[agentId]?.enabled) {
    logger.warn(`${getAgentDisplayName(agentId)} is not enabled.`);
    return;
  }

  // Clean up agent files
  const adapter = getAdapter(agentId, config);
  adapter.clean(cwd);

  config.agents[agentId] = { enabled: false };
  writeConfig(cwd, config);

  logger.success(`Removed ${getAgentDisplayName(agentId)} and deleted its config files.`);
}
