import { loadConfig } from '../core/config.js';
import { compile } from '../core/compiler.js';
import * as logger from '../utils/logger.js';

export async function syncCommand(): Promise<void> {
  const cwd = process.cwd();

  let config;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
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
