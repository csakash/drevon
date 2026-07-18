import { mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync, rmSync } from 'fs';
import { join } from 'path';
import { loadConfig, writeConfig } from './config.js';
import type { DrevonConfig, MemoryConfig } from '../types.js';
import {
  renderIndex,
  topicPointer,
  slugify,
  today,
  detectLayout,
  type IndexModel,
  INDEX_FILE,
  TOPICS_DIR,
  LOG_DIR,
  ARCHIVE_DIR,
  DECISIONS_DIR,
  DEFAULT_EAGER_BUDGET_TOKENS,
} from './memory.js';

export interface MigrateResult {
  status: 'migrated' | 'already-v2' | 'nothing-to-migrate';
  moves: string[]; // workspace-relative paths that were (or would be) written
  backupDir?: string; // workspace-relative backup path
}

export interface MigrateOptions {
  dryRun?: boolean;
}

// Legacy monolithic file → new topic file (relative to topics/).
const TOPIC_MAP: Record<string, { file: string; hint: string }> = {
  'context.md': { file: 'architecture.md', hint: 'project context, structure, key files' },
  'patterns.md': { file: 'patterns.md', hint: 'code conventions, gotchas' },
  'user.md': { file: 'user.md', hint: 'preferences, feedback, decisions' },
  'projects.md': { file: 'projects.md', hint: 'registry of workspace projects' },
  'systems.md': { file: 'systems.md', hint: 'systems & infrastructure' },
};

const MAX_RECENT_LOG = 5;

interface PlannedFile {
  rel: string; // workspace-relative path
  abs: string;
  content: string;
}

/** Split a legacy decisions.md into one file per decision. Unparseable → legacy.md. */
function splitDecisions(content: string, fallbackDate: string): { file: string; content: string }[] {
  const lines = content.split('\n');
  const blocks: { heading: string; body: string[] }[] = [];
  let cur: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { heading: m[1], body: [line] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  if (cur) blocks.push(cur);

  if (blocks.length === 0) {
    return [{ file: 'legacy.md', content: content.trim() + '\n' }];
  }

  const used = new Set<string>();
  const out: { file: string; content: string }[] = [];
  for (const b of blocks) {
    const title = b.heading.replace(/^Decision:\s*/i, '').trim() || 'decision';
    const dateMatch = b.body.join('\n').match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : fallbackDate;
    let file = `${date}-${slugify(title)}.md`;
    let n = 2;
    while (used.has(file)) file = `${date}-${slugify(title)}-${n++}.md`;
    used.add(file);
    out.push({ file, content: b.body.join('\n').trim() + '\n' });
  }
  return out;
}

/** Split a legacy log.md into dated monthly segments; collect headlines for the index. */
function splitLog(content: string): {
  segments: Record<string, string>;
  headlines: string[];
} {
  const lines = content.split('\n');
  const entries: { date: string; title: string; body: string[] }[] = [];
  let cur: { date: string; title: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^#{2,3}\s+(\d{4}-\d{2}-\d{2})\s*(?:[—–-]\s*)?(.*)$/);
    if (m) {
      if (cur) entries.push(cur);
      cur = { date: m[1], title: m[2].trim() || '(no title)', body: [line] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  if (cur) entries.push(cur);

  const byMonth: Record<string, string[]> = {};
  for (const e of entries) {
    const seg = e.date.slice(0, 7);
    (byMonth[seg] ||= []).push(e.body.join('\n').trim());
  }
  const segments: Record<string, string> = {};
  for (const [seg, arr] of Object.entries(byMonth)) {
    segments[seg] = `# Log — ${seg}\n\n${arr.join('\n\n')}\n`;
  }

  const headlines = [...entries]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, MAX_RECENT_LOG)
    .map((e) => `${e.date} — ${e.title}`);

  return { segments, headlines };
}

/**
 * Migrate a `.drevon/memory/` directory from the legacy v1 layout to v2.
 * Non-destructive (originals copied to archive/ before removal) and idempotent
 * (a v2 store returns 'already-v2'). With `dryRun`, computes the plan without writing.
 */
export function migrateMemory(cwd: string, opts: MigrateOptions = {}): MigrateResult {
  const config = loadConfig(cwd);
  const memoryDir = join(cwd, config.memory.directory);
  const relRoot = config.memory.directory;
  const rel = (p: string) => `${relRoot}/${p}`;

  const layout = detectLayout(memoryDir);
  if (layout === 'v2') return { status: 'already-v2', moves: [] };
  if (layout === 'none') return { status: 'nothing-to-migrate', moves: [] };

  const migrationDate = today();
  const budget = config.memory.eagerBudgetTokens ?? DEFAULT_EAGER_BUDGET_TOKENS;

  // Enumerate legacy top-level markdown files.
  const legacyFiles = readdirSync(memoryDir).filter(
    (f) => f.endsWith('.md') && !f.startsWith('.'),
  );

  const planned: PlannedFile[] = [];
  const pointers: string[] = [];
  let headlines: string[] = [];
  let decisionCount = 0;

  const plan = (relPath: string, content: string) =>
    planned.push({ rel: rel(relPath), abs: join(memoryDir, relPath), content });

  for (const legacy of legacyFiles) {
    const src = readFileSync(join(memoryDir, legacy), 'utf-8');

    if (legacy === 'log.md') {
      const { segments, headlines: h } = splitLog(src);
      headlines = h;
      for (const [seg, content] of Object.entries(segments)) {
        plan(`${LOG_DIR}/${seg}.md`, content);
      }
      continue;
    }

    if (legacy === 'decisions.md') {
      const decisions = splitDecisions(src, migrationDate);
      decisionCount = decisions.length;
      for (const d of decisions) {
        plan(`${TOPICS_DIR}/${DECISIONS_DIR}/${d.file}`, d.content);
      }
      continue;
    }

    const mapped = TOPIC_MAP[legacy];
    const topicFile = mapped ? mapped.file : legacy; // unknown/custom → keep name
    const hint = mapped ? mapped.hint : '';
    plan(`${TOPICS_DIR}/${topicFile}`, src.trimEnd() + '\n');
    pointers.push(topicPointer(topicFile, hint));
  }

  if (decisionCount > 0) {
    pointers.push(
      `- [Decisions](${TOPICS_DIR}/${DECISIONS_DIR}/) — ${decisionCount} decision${
        decisionCount === 1 ? '' : 's'
      }`,
    );
  }

  // Build the index.
  const indexModel: IndexModel = {
    project: `${config.name} — migrated from v1 on ${migrationDate}.`,
    activeWork: '',
    topics: pointers,
    recentLog: headlines,
  };
  plan(INDEX_FILE, renderIndex(indexModel, budget));

  const moves = planned.map((p) => p.rel);

  if (opts.dryRun) {
    return { status: 'migrated', moves };
  }

  // 1. Back up every legacy file before touching anything.
  const backupRel = `${ARCHIVE_DIR}/pre-v2-${migrationDate}`;
  const backupAbs = join(memoryDir, backupRel);
  mkdirSync(backupAbs, { recursive: true });
  for (const legacy of legacyFiles) {
    copyFileSync(join(memoryDir, legacy), join(backupAbs, legacy));
  }

  // 2. Write the new store.
  for (const p of planned) {
    mkdirSync(join(p.abs, '..'), { recursive: true });
    writeFileSync(p.abs, p.content);
  }
  // Ensure the standard directories exist even if a source file was absent.
  mkdirSync(join(memoryDir, TOPICS_DIR, DECISIONS_DIR), { recursive: true });
  mkdirSync(join(memoryDir, LOG_DIR), { recursive: true });

  // 3. Remove the legacy originals (preserved in the backup).
  for (const legacy of legacyFiles) {
    rmSync(join(memoryDir, legacy), { force: true });
  }

  // 4. Rewrite config to the v2 memory shape + strip the legacy protocol instruction.
  writeConfig(cwd, upgradeConfigToV2(config));

  return { status: 'migrated', moves, backupDir: rel(backupRel) };
}

/** Convert a v1 config's memory block + instructions to the v2 shape. Pure. */
export function upgradeConfigToV2(config: DrevonConfig): DrevonConfig {
  const memory: MemoryConfig = {
    ...config.memory,
    layout: 'v2',
    indexFile: `${config.memory.directory}/${INDEX_FILE}`,
    eagerBudgetTokens: config.memory.eagerBudgetTokens ?? DEFAULT_EAGER_BUDGET_TOKENS,
    retentionMonths: config.memory.retentionMonths ?? 3,
    files:
      config.mode === 'hub'
        ? {
            index: `${config.memory.directory}/${INDEX_FILE}`,
            user: `${config.memory.directory}/${TOPICS_DIR}/user.md`,
            projects: `${config.memory.directory}/${TOPICS_DIR}/projects.md`,
            systems: `${config.memory.directory}/${TOPICS_DIR}/systems.md`,
          }
        : {
            index: `${config.memory.directory}/${INDEX_FILE}`,
            architecture: `${config.memory.directory}/${TOPICS_DIR}/architecture.md`,
            patterns: `${config.memory.directory}/${TOPICS_DIR}/patterns.md`,
          },
  };

  return {
    ...config,
    version: Math.max(config.version, 2),
    memory,
    // The v2 protocol is emitted canonically by the adapters; drop the legacy duplicate.
    instructions: config.instructions.filter((i) => i.id !== 'memory-protocol'),
  };
}
