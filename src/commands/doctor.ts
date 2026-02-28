import { existsSync } from 'fs';
import { join } from 'path';
import type { AgentId } from '../types.js';
import { loadConfig } from '../core/config.js';
import { getAdapter, getAgentDisplayName } from '../adapters/registry.js';
import * as logger from '../utils/logger.js';
import { colors } from '../utils/logger.js';
import pc from 'picocolors';

export async function doctorCommand(): Promise<void> {
  const cwd = process.cwd();

  let config;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    logger.error((err as Error).message);
    console.log('  Fix: Run `drevon init` to create a config.');
    process.exit(1);
  }

  console.log();
  console.log(pc.dim('  ┌ ') + colors.orangeBold('drevon doctor'));
  console.log(pc.dim('  │'));

  let issues = 0;

  // Check agents
  const enabledAgents = Object.entries(config.agents)
    .filter(([, cfg]) => cfg?.enabled)
    .map(([id]) => id as AgentId);

  for (const agentId of enabledAgents) {
    const adapter = getAdapter(agentId, config);
    const diagnostics = adapter.diagnose(cwd);
    for (const d of diagnostics) {
      if (d.status !== 'ok') {
        console.log(pc.dim('  │ ') + `${colors.peach('▲')} ${colors.yellow(getAgentDisplayName(agentId))}: ${d.file} — ${d.message}`);
        issues++;
      }
    }
  }

  // Check memory files
  if (config.memory.enabled) {
    for (const [key, filePath] of Object.entries(config.memory.files)) {
      if (!existsSync(join(cwd, filePath))) {
        console.log(pc.dim('  │ ') + `${colors.pink('✖')} Memory file missing: ${pc.dim(filePath)}`);
        issues++;
      }
    }
  }

  // Check skills-lock.json
  if (config.skills.enabled) {
    if (!existsSync(join(cwd, config.skills.lockFile))) {
      console.log(pc.dim('  │ ') + `${colors.peach('▲')} skills-lock.json is missing`);
      issues++;
    }
  }

  // Check prompts dir
  if (config.prompts.enabled) {
    if (!existsSync(join(cwd, config.prompts.directory))) {
      console.log(pc.dim('  │ ') + `${colors.peach('▲')} Prompts directory missing: ${pc.dim(config.prompts.directory)}`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log(pc.dim('  │'));
    console.log(pc.dim('  └ ') + colors.yellowBold('✔ No issues found. Everything looks good!'));
  } else {
    console.log(pc.dim('  │'));
    console.log(pc.dim('  └ ') + colors.pinkBold(`${issues} issue(s) found.`) + ` Run ${colors.yellow('drevon sync')} to fix most issues.`);  }
  console.log();
}
