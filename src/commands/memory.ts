import { join } from 'path';
import { loadConfig, findProjectRoot } from '../core/config.js';
import type { DrevonConfig } from '../types.js';
import {
  initMemory,
  appendLog,
  addDecision,
  addLearning,
  setNote,
  memoryStats,
  detectLayout,
  DEFAULT_EAGER_BUDGET_TOKENS,
} from '../core/memory.js';
import { migrateMemory } from '../core/memory-migrate.js';
import { compactMemory } from '../core/memory-compact.js';
import { searchMemory } from '../core/memory-search.js';
import * as logger from '../utils/logger.js';
import { colors } from '../utils/logger.js';
import pc from 'picocolors';

interface MemoryContext {
  cwd: string;
  config: DrevonConfig;
  memoryDir: string;
  budget: number;
}

function resolve(): MemoryContext {
  let cwd: string;
  try {
    cwd = findProjectRoot(process.cwd());
  } catch {
    logger.error('No drevon.config.json found. Run "drevon init" first.');
    process.exit(1);
  }
  let config: DrevonConfig;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }
  if (!config.memory.enabled) {
    logger.error('Memory is disabled for this workspace.');
    process.exit(1);
  }
  const memoryDir = join(cwd, config.memory.directory);
  const budget = config.memory.eagerBudgetTokens ?? DEFAULT_EAGER_BUDGET_TOKENS;
  return { cwd, config, memoryDir, budget };
}

/** Ensure the store is a writable v2 layout, or guide the user to migrate. */
function ensureWritable(ctx: MemoryContext): void {
  const layout = detectLayout(ctx.memoryDir);
  if (layout === 'v1') {
    logger.error('Legacy memory layout detected. Run `drevon memory migrate` first.');
    process.exit(1);
  }
  if (layout === 'none') {
    initMemory(ctx.cwd, ctx.config.mode, ctx.config.name);
  }
}

export function memoryLog(text: string): void {
  const ctx = resolve();
  ensureWritable(ctx);
  const headline = appendLog(ctx.memoryDir, text);
  logger.success(`Logged: ${pc.dim(headline)}`);
}

export function memoryDecide(title: string, opts: { why?: string }): void {
  const ctx = resolve();
  ensureWritable(ctx);
  const rel = addDecision(ctx.memoryDir, title, opts.why);
  logger.success(`Decision recorded: ${pc.dim(rel)}`);
}

export function memoryLearn(text: string, opts: { topic?: string }): void {
  const ctx = resolve();
  ensureWritable(ctx);
  const topic = opts.topic || (ctx.config.mode === 'hub' ? 'user' : 'patterns');
  const rel = addLearning(ctx.memoryDir, text, topic);
  logger.success(`Learning saved to ${pc.dim(rel)}`);
}

export function memoryNote(text: string): void {
  const ctx = resolve();
  ensureWritable(ctx);
  setNote(ctx.memoryDir, text);
  logger.success('Active-work note updated.');
}

export function memoryStatus(): void {
  const ctx = resolve();
  const stats = memoryStats(ctx.memoryDir);

  console.log();
  console.log(pc.dim('  ┌ ') + colors.orangeBold('drevon memory'));
  console.log(pc.dim('  │'));
  console.log(pc.dim('  │ ') + `Layout      ${colors.yellow(stats.layout)}`);

  if (stats.layout === 'v1') {
    console.log(
      pc.dim('  │ ') +
        `${colors.peach('▲')} Legacy layout — eager load is ${colors.pink(
          `~${stats.totalTokens.toLocaleString()} tokens`,
        )} every session.`,
    );
    console.log(pc.dim('  │ ') + `  Run ${colors.yellow('drevon memory migrate')} to switch to v2.`);
    console.log(pc.dim('  └'));
    console.log();
    return;
  }

  const eager = stats.tiers.index;
  const overBudget = eager > ctx.budget;
  const eagerColor = overBudget ? colors.pink : colors.yellow;
  console.log(
    pc.dim('  │ ') +
      `Eager load  ${eagerColor(`~${eager.toLocaleString()} tokens`)} ${pc.dim(
        `(budget ${ctx.budget.toLocaleString()})`,
      )}`,
  );
  console.log(pc.dim('  │'));
  console.log(pc.dim('  ├ ') + colors.orangeBold('Tiers (on-demand)'));
  console.log(pc.dim('  │ ') + `  topics   ~${stats.tiers.topics.toLocaleString()} tokens`);
  console.log(pc.dim('  │ ') + `  log      ~${stats.tiers.log.toLocaleString()} tokens`);
  console.log(pc.dim('  │ ') + `  archive  ~${stats.tiers.archive.toLocaleString()} tokens`);
  console.log(pc.dim('  │'));
  console.log(
    pc.dim('  │ ') + `Total       ~${stats.totalTokens.toLocaleString()} tokens across ${stats.files} files`,
  );

  if (overBudget) {
    console.log(pc.dim('  │'));
    console.log(
      pc.dim('  │ ') + `${colors.peach('▲')} Index exceeds its budget — run ${colors.yellow('drevon memory compact')}.`,
    );
  }
  console.log(pc.dim('  └'));
  console.log();
}

export function memoryMigrate(opts: { dryRun?: boolean }): void {
  const ctx = resolve();
  const result = migrateMemory(ctx.cwd, { dryRun: opts.dryRun });

  if (result.status === 'already-v2') {
    logger.success('Memory is already on the v2 layout. Nothing to do.');
    return;
  }
  if (result.status === 'nothing-to-migrate') {
    logger.info('No existing memory found — initializing a fresh v2 store.');
    initMemory(ctx.cwd, ctx.config.mode, ctx.config.name);
    logger.success('Initialized v2 memory store.');
    return;
  }

  if (opts.dryRun) {
    console.log();
    console.log(pc.dim('  ┌ ') + colors.orangeBold('drevon memory migrate (dry run)'));
    for (const move of result.moves) {
      console.log(pc.dim('  │ ') + `  ${colors.orange('→')} ${move}`);
    }
    console.log(pc.dim('  └ ') + pc.dim('No files written. Re-run without --dry-run to apply.'));
    console.log();
    return;
  }

  for (const move of result.moves) {
    logger.fileCreated(move);
  }
  logger.success(
    `Migrated to v2. Originals backed up at ${pc.dim(result.backupDir!)}. ` +
      `Run ${colors.yellow('drevon sync')} to refresh agent configs.`,
  );
}

export function memoryCompact(): void {
  const ctx = resolve();
  if (detectLayout(ctx.memoryDir) === 'v1') {
    logger.error('Legacy memory layout detected. Run `drevon memory migrate` first.');
    process.exit(1);
  }
  const result = compactMemory(ctx.cwd);
  if (result.rotatedMonths.length === 0) {
    logger.success('Memory is already compact — nothing older than the retention window.');
    return;
  }
  for (const m of result.rotatedMonths) {
    logger.info(`Rolled ${m} into log/summaries.md and archived its body.`);
  }
  logger.success(
    `Compacted ${result.rotatedMonths.length} month(s). Bodies preserved under archive/.`,
  );
}

export function memorySearch(query: string, opts: { limit?: string }): void {
  const ctx = resolve();
  const limit = opts.limit ? parseInt(opts.limit, 10) : 10;
  const hits = searchMemory(ctx.memoryDir, query, Number.isFinite(limit) ? limit : 10);

  console.log();
  console.log(pc.dim('  ┌ ') + colors.orangeBold(`memory search: ${query}`));
  if (hits.length === 0) {
    console.log(pc.dim('  └ ') + pc.dim('No matches.'));
    console.log();
    return;
  }
  console.log(pc.dim('  │'));
  for (const hit of hits) {
    console.log(pc.dim('  │ ') + `${colors.yellow(hit.file)} ${pc.dim(`(${hit.score.toFixed(2)})`)}`);
    if (hit.snippet) console.log(pc.dim('  │ ') + `  ${pc.dim(hit.snippet)}`);
  }
  console.log(pc.dim('  └'));
  console.log();
}
