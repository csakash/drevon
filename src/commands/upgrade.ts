import { loadConfig, writeConfig } from '../core/config.js';
import { compile } from '../core/compiler.js';
import * as logger from '../utils/logger.js';

interface Migration {
  fromVersion: number;
  toVersion: number;
  migrate: (config: any) => any;
}

const migrations: Migration[] = [
  // Future migrations go here
  // { fromVersion: 1, toVersion: 2, migrate: (config) => { ... return config; } }
];

export async function upgradeCommand(): Promise<void> {
  const cwd = process.cwd();

  let config;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  const currentVersion = config.version;
  const latestVersion = migrations.length > 0
    ? migrations[migrations.length - 1].toVersion
    : currentVersion;

  if (currentVersion >= latestVersion) {
    logger.success(`Config is already at the latest version (v${currentVersion}).`);
    return;
  }

  let upgraded = config as any;
  for (const migration of migrations) {
    if (upgraded.version === migration.fromVersion) {
      logger.info(`Migrating v${migration.fromVersion} → v${migration.toVersion}...`);
      upgraded = migration.migrate(upgraded);
    }
  }

  writeConfig(cwd, upgraded);
  const result = compile(cwd, upgraded);

  for (const f of result.updated) {
    logger.fileUpdated(f);
  }

  logger.success(`Config upgraded from v${currentVersion} to v${upgraded.version}.`);
}
