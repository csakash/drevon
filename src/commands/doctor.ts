import { existsSync, statSync } from 'fs';
import { join } from 'path';
import type { AgentId } from '../types.js';
import { loadConfig, findProjectRoot } from '../core/config.js';
import { getAdapter, getAgentDisplayName } from '../adapters/registry.js';
import { detectLayout, memoryStats, DEFAULT_EAGER_BUDGET_TOKENS } from '../core/memory.js';
import * as logger from '../utils/logger.js';
import { colors } from '../utils/logger.js';
import pc from 'picocolors';

const CODEX_MAX_BYTES = 32 * 1024; // Codex silently truncates AGENTS.md past 32 KiB

export async function doctorCommand(): Promise<void> {
  let cwd: string;
  try {
    cwd = findProjectRoot(process.cwd());
  } catch {
    logger.error('No drevon.config.json found. Run "drevon init" first.');
    process.exit(1);
  }

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

  // Codex silently truncates AGENTS.md past 32 KiB — warn before that bites.
  if (config.agents.codex?.enabled) {
    const agentsPath = join(cwd, 'AGENTS.md');
    if (existsSync(agentsPath)) {
      const bytes = statSync(agentsPath).size;
      if (bytes > CODEX_MAX_BYTES) {
        console.log(
          pc.dim('  │ ') +
            `${colors.peach('▲')} AGENTS.md is ${(bytes / 1024).toFixed(1)} KiB — Codex truncates past 32 KiB. Trim instructions.`,
        );
        issues++;
      }
    }
  }

  // Check memory
  if (config.memory.enabled) {
    const memoryDir = join(cwd, config.memory.directory);
    const layout = detectLayout(memoryDir);

    if (layout === 'v1') {
      console.log(
        pc.dim('  │ ') +
          `${colors.peach('▲')} Legacy memory layout — run ${colors.yellow('drevon memory migrate')} to cut eager token cost.`,
      );
      issues++;
    } else if (layout === 'v2') {
      const stats = memoryStats(memoryDir);
      const budget = config.memory.eagerBudgetTokens ?? DEFAULT_EAGER_BUDGET_TOKENS;
      if (stats.tiers.index > budget) {
        console.log(
          pc.dim('  │ ') +
            `${colors.peach('▲')} Index is ~${stats.tiers.index.toLocaleString()} tokens (budget ${budget.toLocaleString()}) — run ${colors.yellow('drevon memory compact')}.`,
        );
        issues++;
      }
    }

    // Topic files referenced by config should still exist.
    for (const filePath of Object.values(config.memory.files)) {
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
