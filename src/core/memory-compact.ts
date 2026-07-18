import {
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from 'fs';
import { join } from 'path';
import { loadConfig } from './config.js';
import {
  LOG_DIR,
  ARCHIVE_DIR,
  currentMonth,
  updateIndex,
  detectLayout,
  extractHeadlines,
} from './memory.js';
import { scoreMemory, retentionTier } from './retention.js';

export interface CompactResult {
  rotatedMonths: string[];
  archived: string[];
  indexRebuilt: boolean;
}

const SEGMENT_RE = /^\d{4}-\d{2}\.md$/;

/** Whole months between two YYYY-MM strings (b - a). */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

/**
 * Mechanical compaction (no LLM): roll log segments older than the retention
 * window into `log/summaries.md` (headlines) and move their bodies to
 * `archive/log/` (non-destructive). Then re-enforce the index budget.
 *
 * Only Tier 2 log segments are touched — topics (architecture, patterns) and
 * decisions are never archived here (see retention.PROTECTED_TYPES).
 */
export function compactMemory(cwd: string): CompactResult {
  const config = loadConfig(cwd);
  const memoryDir = join(cwd, config.memory.directory);
  const retentionMonths = config.memory.retentionMonths ?? 3;
  const budget = config.memory.eagerBudgetTokens;
  const result: CompactResult = { rotatedMonths: [], archived: [], indexRebuilt: false };

  const logDir = join(memoryDir, LOG_DIR);
  const cur = currentMonth();

  if (existsSync(logDir)) {
    const segments = readdirSync(logDir)
      .filter((f) => SEGMENT_RE.test(f))
      .sort();
    const archiveLogDir = join(memoryDir, ARCHIVE_DIR, LOG_DIR);
    const summariesPath = join(logDir, 'summaries.md');

    for (const seg of segments) {
      const month = seg.replace(/\.md$/, '');
      if (monthsBetween(month, cur) <= retentionMonths) continue;

      const content = readFileSync(join(logDir, seg), 'utf-8');
      const headlines = extractHeadlines(content);
      const ageDays = monthsBetween(month, cur) * 30;
      const tier = retentionTier(scoreMemory('log', ageDays));

      const block =
        `\n## ${month} _(${tier})_\n\n` +
        (headlines.length ? headlines.map((h) => `- ${h}`).join('\n') : '_no entries_') +
        '\n';
      if (existsSync(summariesPath)) appendFileSync(summariesPath, block);
      else writeFileSync(summariesPath, `# Log Summaries\n\n> Headlines of archived months. Bodies live in \`archive/log/\`.\n${block}`);

      mkdirSync(archiveLogDir, { recursive: true });
      renameSync(join(logDir, seg), join(archiveLogDir, seg));
      result.rotatedMonths.push(month);
      result.archived.push(`${ARCHIVE_DIR}/${LOG_DIR}/${seg}`);
    }
  }

  // Re-enforce the eager budget by re-rendering the index.
  if (detectLayout(memoryDir) === 'v2') {
    updateIndex(memoryDir, (m) => m, budget);
    result.indexRebuilt = true;
  }

  return result;
}
