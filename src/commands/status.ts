import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AgentId } from '../types.js';
import { loadConfig } from '../core/config.js';
import { getAdapter, getAgentDisplayName } from '../adapters/registry.js';
import * as logger from '../utils/logger.js';
import pc from 'picocolors';

export async function statusCommand(): Promise<void> {
  const cwd = process.cwd();

  let config;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  console.log();
  console.log(pc.bold(`  drevon workspace: ${config.name}`));
  console.log(`  Mode: ${pc.cyan(config.mode)}`);
  console.log(`  Identity: ${pc.cyan(config.identity.role)}`);
  console.log();

  // Agents
  console.log(pc.bold('  Agents:'));
  const enabledAgents = Object.entries(config.agents)
    .filter(([, cfg]) => cfg?.enabled)
    .map(([id]) => id as AgentId);

  for (const agentId of enabledAgents) {
    const adapter = getAdapter(agentId, config);
    const diagnostics = adapter.diagnose(cwd);
    const allOk = diagnostics.every((d) => d.status === 'ok');
    const status = allOk ? pc.green('✔') : pc.yellow('⚠');
    console.log(`    ${status} ${getAgentDisplayName(agentId)}`);
  }
  console.log();

  // Memory
  console.log(pc.bold('  Memory:'));
  if (config.memory.enabled) {
    for (const [, filePath] of Object.entries(config.memory.files)) {
      const exists = existsSync(join(cwd, filePath));
      const status = exists ? pc.green('✔') : pc.red('✖');
      console.log(`    ${status} ${filePath}`);
    }
  } else {
    console.log('    Disabled');
  }
  console.log();

  // Skills
  console.log(pc.bold('  Skills:'));
  const skillsDir = join(cwd, '.drevon', 'skills');
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir).filter(
      (f) => !f.startsWith('.'),
    );
    if (skills.length > 0) {
      for (const s of skills) {
        console.log(`    • ${s}`);
      }
    } else {
      console.log('    No skills installed');
    }
  } else {
    console.log('    Not initialized');
  }
  console.log();

  // Prompts
  console.log(pc.bold('  Prompts:'));
  const promptsDir = join(cwd, '.drevon', 'prompts');
  if (existsSync(promptsDir)) {
    const prompts = readdirSync(promptsDir).filter(
      (f) => f.endsWith('.md') && f !== '_index.md',
    );
    console.log(`    ${prompts.length} prompt(s) available`);
  } else {
    console.log('    Not initialized');
  }
  console.log();
}
