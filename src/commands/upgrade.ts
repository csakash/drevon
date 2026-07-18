import { join } from 'path';
import { loadConfig, writeConfig, findProjectRoot } from '../core/config.js';
import { compile } from '../core/compiler.js';
import { detectLayout } from '../core/memory.js';
import { migrateMemory, upgradeConfigToV2 } from '../core/memory-migrate.js';
import * as logger from '../utils/logger.js';

const LATEST_VERSION = 2;

export async function upgradeCommand(): Promise<void> {
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

  const currentVersion = config.version;
  const memoryDir = join(cwd, config.memory.directory);
  const needsMemoryMigration = config.memory.enabled && detectLayout(memoryDir) === 'v1';

  if (currentVersion >= LATEST_VERSION && !needsMemoryMigration) {
    logger.success(`Config is already at the latest version (v${currentVersion}).`);
    return;
  }

  // v1 → v2: migrate the memory store (also rewrites the config to the v2 shape).
  if (needsMemoryMigration) {
    logger.info('Migrating memory store v1 → v2...');
    const result = migrateMemory(cwd);
    if (result.status === 'migrated') {
      logger.success(`Memory migrated to v2. Originals backed up at ${result.backupDir}.`);
    }
    config = loadConfig(cwd); // reload the rewritten config
  } else if (currentVersion < LATEST_VERSION) {
    // Config is behind but the memory store is already v2 (or disabled) — just bump the shape.
    config = upgradeConfigToV2(config);
    writeConfig(cwd, config);
  }

  const result = compile(cwd, config);
  for (const f of result.updated) {
    logger.fileUpdated(f);
  }

  logger.success(`Config upgraded from v${currentVersion} to v${config.version}.`);
}
