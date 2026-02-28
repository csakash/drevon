import { existsSync } from 'fs';
import { join } from 'path';
import type { AgentId } from '../types.js';
import { loadConfig } from '../core/config.js';
import { getAdapter, getAgentDisplayName } from '../adapters/registry.js';
import * as logger from '../utils/logger.js';
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
  console.log(pc.bold('  drevon doctor'));
  console.log();

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
        console.log(`  ${pc.yellow('⚠')} ${getAgentDisplayName(agentId)}: ${d.file} — ${d.message}`);
        issues++;
      }
    }
  }

  // Check memory files
  if (config.memory.enabled) {
    for (const [key, filePath] of Object.entries(config.memory.files)) {
      if (!existsSync(join(cwd, filePath))) {
        console.log(`  ${pc.red('✖')} Memory file missing: ${filePath}`);
        issues++;
      }
    }
  }

  // Check skills-lock.json
  if (config.skills.enabled) {
    if (!existsSync(join(cwd, config.skills.lockFile))) {
      console.log(`  ${pc.yellow('⚠')} skills-lock.json is missing`);
      issues++;
    }
  }

  // Check prompts dir
  if (config.prompts.enabled) {
    if (!existsSync(join(cwd, config.prompts.directory))) {
      console.log(`  ${pc.yellow('⚠')} Prompts directory missing: ${config.prompts.directory}`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log(`  ${pc.green('✔')} No issues found. Everything looks good!`);
  } else {
    console.log();
    console.log(`  ${issues} issue(s) found. Run \`drevon sync\` to fix most issues.`);
  }
  console.log();
}
