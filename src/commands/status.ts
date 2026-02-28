import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AgentId } from '../types.js';
import { loadConfig } from '../core/config.js';
import { getAdapter, getAgentDisplayName } from '../adapters/registry.js';
import * as logger from '../utils/logger.js';
import { colors } from '../utils/logger.js';
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
  console.log(pc.dim('  ┌ ') + colors.orangeBold(`drevon workspace: ${config.name}`));
  console.log(pc.dim('  │'));
  console.log(pc.dim('  │ ') + `Mode     ${colors.yellow(config.mode)}`);
  console.log(pc.dim('  │ ') + `Identity ${colors.yellow(config.identity.role)}`);
  console.log(pc.dim('  │'));

  // Agents
  console.log(pc.dim('  ├ ') + colors.orangeBold('Agents'));
  const enabledAgents = Object.entries(config.agents)
    .filter(([, cfg]) => cfg?.enabled)
    .map(([id]) => id as AgentId);

  for (const agentId of enabledAgents) {
    const adapter = getAdapter(agentId, config);
    const diagnostics = adapter.diagnose(cwd);
    const allOk = diagnostics.every((d) => d.status === 'ok');
    const status = allOk ? colors.yellow('✔') : colors.peach('▲');
    console.log(pc.dim('  │ ') + `  ${status} ${colors.yellow(getAgentDisplayName(agentId))}`);
  }
  console.log(pc.dim('  │'));

  // Memory
  console.log(pc.dim('  ├ ') + colors.orangeBold('Memory'));
  if (config.memory.enabled) {
    for (const [, filePath] of Object.entries(config.memory.files)) {
      const exists = existsSync(join(cwd, filePath));
      const status = exists ? colors.yellow('✔') : colors.pink('✖');
      console.log(pc.dim('  │ ') + `  ${status} ${pc.dim(filePath)}`);
    }
  } else {
    console.log(pc.dim('  │ ') + `  ${pc.dim('Disabled')}`);
  }
  console.log(pc.dim('  │'));

  // Skills
  console.log(pc.dim('  ├ ') + colors.orangeBold('Skills'));
  const skillsDir = join(cwd, '.drevon', 'skills');
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir).filter(
      (f) => !f.startsWith('.'),
    );
    if (skills.length > 0) {
      for (const s of skills) {
        console.log(pc.dim('  │ ') + `  ${colors.orange('●')} ${colors.yellow(s)}`);
      }
    } else {
      console.log(pc.dim('  │ ') + `  ${pc.dim('No skills installed')}`);
    }
  } else {
    console.log(pc.dim('  │ ') + `  ${pc.dim('Not initialized')}`);
  }
  console.log(pc.dim('  │'));

  // Prompts
  console.log(pc.dim('  ├ ') + colors.orangeBold('Prompts'));
  const promptsDir = join(cwd, '.drevon', 'prompts');
  if (existsSync(promptsDir)) {
    const prompts = readdirSync(promptsDir).filter(
      (f) => f.endsWith('.md') && f !== '_index.md',
    );
    console.log(pc.dim('  │ ') + `  ${colors.yellow(String(prompts.length))} prompt(s) available`);
  } else {
    console.log(pc.dim('  │ ') + `  ${pc.dim('Not initialized')}`);
  }
  console.log(pc.dim('  └'));
  console.log();
}
