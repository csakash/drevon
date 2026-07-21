import { join } from 'path';
import { loadConfig, findProjectRoot } from '../core/config.js';
import { compile } from '../core/compiler.js';
import { migrateAgentsSkills } from '../core/skills.js';
import { detectLayout } from '../core/memory.js';
import { migrateMemory } from '../core/memory-migrate.js';
import * as logger from '../utils/logger.js';

export async function syncCommand(opts: { migrate?: boolean } = {}): Promise<void> {
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
    process.exit(1);
  }

  // Migrate .agents/skills/ → .drevon/skills/ if any exist
  const migrated = migrateAgentsSkills(cwd);
  for (const name of migrated) {
    logger.info(`Migrated skill from .agents/skills/${name} → .drevon/skills/${name}`);
  }

  // Auto-migrate a legacy memory store to v2 (non-destructive, backed up).
  // `--no-migrate` skips it. Commander sets opts.migrate = false for --no-migrate.
  if (config.memory.enabled && opts.migrate !== false) {
    const memoryDir = join(cwd, config.memory.directory);
    if (detectLayout(memoryDir) === 'v1') {
      logger.info('Legacy memory layout detected — migrating to v2...');
      const result = migrateMemory(cwd);
      if (result.status === 'migrated') {
        logger.success(`Memory migrated to v2. Originals backed up at ${result.backupDir}.`);
        config = loadConfig(cwd); // reload the config the migration rewrote
      }
    }
  }

  logger.info(`Syncing from drevon.config.json (${config.mode} mode)...`);
  console.log();

  const result = compile(cwd, config);

  for (const f of result.created) {
    logger.fileCreated(f);
  }
  for (const f of result.updated) {
    logger.fileUpdated(f);
  }
  for (const f of result.unchanged) {
    logger.fileUnchanged(f);
  }

  console.log();
  logger.success('All agent configs synced.');
}
