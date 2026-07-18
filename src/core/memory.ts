import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs';
import { join } from 'path';
import type { DrevonMode } from '../types.js';

// ── v2 memory store ───────────────────────────────────────────────
// Layout under `.drevon/memory/`:
//   INDEX.md          Tier 0 — the ONLY file read eagerly at session start (budget-capped)
//   topics/           Tier 1 — read on demand (architecture, patterns, decisions/, …)
//   log/<YYYY-MM>.md  Tier 2 — episodic, never eagerly read; append via CLI
//   archive/          non-destructive home for migrated originals + evicted content

export const INDEX_FILE = 'INDEX.md';
export const TOPICS_DIR = 'topics';
export const LOG_DIR = 'log';
export const ARCHIVE_DIR = 'archive';
export const DECISIONS_DIR = 'decisions'; // nested under topics/

export const DEFAULT_EAGER_BUDGET_TOKENS = 2000;
const MAX_RECENT_LOG = 5;
const MAX_TOPIC_POINTERS = 40;

const LEGACY_FILES = [
  'context.md',
  'decisions.md',
  'patterns.md',
  'log.md',
  'user.md',
  'projects.md',
  'systems.md',
];

interface TopicDef {
  file: string;
  title: string;
  hint: string;
}

const PROJECT_TOPICS: TopicDef[] = [
  { file: 'architecture.md', title: 'Architecture', hint: 'project context, structure, key files' },
  { file: 'patterns.md', title: 'Patterns', hint: 'code conventions, gotchas' },
];

const HUB_TOPICS: TopicDef[] = [
  { file: 'user.md', title: 'User', hint: 'preferences, feedback, decisions' },
  { file: 'projects.md', title: 'Projects', hint: 'registry of workspace projects' },
  { file: 'systems.md', title: 'Systems', hint: 'systems & infrastructure' },
];

// ── small utilities ───────────────────────────────────────────────

export type DetectedLayout = 'v2' | 'v1' | 'none';

/** Estimate token count from character length (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Today as YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Current month segment as YYYY-MM. */
export function currentMonth(): string {
  return today().slice(0, 7);
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function titleFromFile(file: string): string {
  const base = file.replace(/\.md$/, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Which store layout exists in a `.drevon/memory` directory. */
export function detectLayout(memoryDir: string): DetectedLayout {
  if (existsSync(join(memoryDir, INDEX_FILE))) return 'v2';
  if (LEGACY_FILES.some((f) => existsSync(join(memoryDir, f)))) return 'v1';
  return 'none';
}

// ── INDEX model (parse / render) ──────────────────────────────────

export interface IndexModel {
  project: string;
  activeWork: string;
  topics: string[]; // full markdown pointer lines, e.g. "- [Architecture](topics/architecture.md) — hint"
  recentLog: string[]; // headlines "YYYY-MM-DD — title"
}

function isPlaceholder(text: string): boolean {
  return text.startsWith('_') && text.endsWith('_');
}

/** Split markdown into a map of `## Section` → trimmed body. Heading-driven, regex-light. */
function splitSections(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  let current: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current !== null) out[current] = buf.join('\n').trim();
    buf = [];
  };
  for (const line of content.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      current = m[1];
    } else if (current !== null) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

export function parseIndex(content: string): IndexModel {
  const sections = splitSections(content);
  const project =
    sections['Project'] && !isPlaceholder(sections['Project']) ? sections['Project'] : '';
  const activeWork =
    sections['Active Work'] && !isPlaceholder(sections['Active Work']) ? sections['Active Work'] : '';

  const topicsBody = sections['Topics'] ?? '';
  const topics =
    topicsBody && !isPlaceholder(topicsBody)
      ? topicsBody
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('- '))
      : [];

  const recentBody = sections['Recent Log'] ?? '';
  const recentLog =
    recentBody && !isPlaceholder(recentBody)
      ? recentBody
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('- '))
          .map((l) => l.replace(/^-\s+/, ''))
      : [];

  return { project, activeWork, topics, recentLog };
}

/** Render INDEX.md, trimming the recent-log tail if the eager budget is exceeded. */
export function renderIndex(model: IndexModel, budgetTokens = DEFAULT_EAGER_BUDGET_TOKENS): string {
  let recent = model.recentLog.slice(0, MAX_RECENT_LOG);
  const topics = model.topics.slice(0, MAX_TOPIC_POINTERS);

  const build = (): string =>
    `# Memory Index

> Session start: read THIS file only. Load a topic file below only when it is relevant to your task.
> Record memory via \`drevon memory log|decide|learn|note\` — never hand-edit the log segments.
> Recall older history with \`drevon memory search "<query>"\`.

## Project

${model.project || '_Not described yet._'}

## Active Work

${model.activeWork || '_Nothing in progress._'}

## Topics

${topics.length ? topics.join('\n') : '_No topics yet._'}

## Recent Log

${recent.length ? recent.map((h) => `- ${h}`).join('\n') : '_No entries yet._'}

<!-- Full history lives in log/ — search it with \`drevon memory search\`. -->
`;

  let out = build();
  while (estimateTokens(out) > budgetTokens && recent.length > 1) {
    recent = recent.slice(0, recent.length - 1);
    out = build();
  }
  return out;
}

// ── INDEX read / mutate ───────────────────────────────────────────

function indexPath(memoryDir: string): string {
  return join(memoryDir, INDEX_FILE);
}

function readIndexModel(memoryDir: string): IndexModel {
  const p = indexPath(memoryDir);
  if (!existsSync(p)) return { project: '', activeWork: '', topics: [], recentLog: [] };
  return parseIndex(readFileSync(p, 'utf-8'));
}

function writeIndexModel(memoryDir: string, model: IndexModel, budgetTokens?: number): void {
  ensureDir(memoryDir);
  writeFileSync(indexPath(memoryDir), renderIndex(model, budgetTokens));
}

/** Read → mutate → rewrite INDEX.md. Never touches Tier 2 log segments. */
export function updateIndex(
  memoryDir: string,
  mutate: (model: IndexModel) => IndexModel,
  budgetTokens?: number,
): void {
  const model = mutate(readIndexModel(memoryDir));
  writeIndexModel(memoryDir, model, budgetTokens);
}

export function topicPointer(file: string, hint: string): string {
  const title = titleFromFile(file.split('/').pop() ?? file);
  return `- [${title}](${TOPICS_DIR}/${file})${hint ? ` — ${hint}` : ''}`;
}

/** Ensure a Topics pointer exists for a topic file (idempotent by file path). */
export function ensureTopicPointer(memoryDir: string, file: string, hint = ''): void {
  const marker = `(${TOPICS_DIR}/${file})`;
  updateIndex(memoryDir, (m) => {
    if (!m.topics.some((t) => t.includes(marker))) {
      m.topics.push(topicPointer(file, hint));
    }
    return m;
  });
}

/** Rebuild the single decisions pointer line from a cheap directory listing. */
export function refreshDecisionsPointer(memoryDir: string): void {
  const dir = join(memoryDir, TOPICS_DIR, DECISIONS_DIR);
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.md') && f !== 'README.md')
        .sort()
    : [];
  const count = files.length;
  let latestTitle = '';
  if (count > 0) {
    const latest = files[files.length - 1];
    const first = readFileSync(join(dir, latest), 'utf-8')
      .split('\n')
      .find((l) => l.startsWith('# '));
    latestTitle = first ? first.replace(/^#\s+/, '').trim() : latest.replace(/\.md$/, '');
  }
  const marker = `(${TOPICS_DIR}/${DECISIONS_DIR}/)`;
  const line =
    count > 0
      ? `- [Decisions](${TOPICS_DIR}/${DECISIONS_DIR}/) — ${count} decision${
          count === 1 ? '' : 's'
        } (latest: ${latestTitle})`
      : '';
  updateIndex(memoryDir, (m) => {
    m.topics = m.topics.filter((t) => !t.includes(marker));
    if (line) m.topics.push(line);
    return m;
  });
}

// ── scaffolding ───────────────────────────────────────────────────

function topicStub(t: TopicDef): string {
  return `# ${t.title}\n\n<!-- ${t.hint} -->\n`;
}

/**
 * Scaffold the v2 memory store. Idempotent: only creates missing pieces.
 * Returns the workspace-relative paths of files created.
 */
export function initMemory(dir: string, mode: DrevonMode, name?: string): string[] {
  const memoryDir = join(dir, '.drevon', 'memory');
  const created: string[] = [];
  const rel = (p: string) => `.drevon/memory/${p}`;

  ensureDir(join(memoryDir, TOPICS_DIR, DECISIONS_DIR));
  ensureDir(join(memoryDir, LOG_DIR));
  ensureDir(join(memoryDir, ARCHIVE_DIR));

  const topics = mode === 'hub' ? HUB_TOPICS : PROJECT_TOPICS;
  const pointers: string[] = [];
  for (const t of topics) {
    const p = join(memoryDir, TOPICS_DIR, t.file);
    if (!existsSync(p)) {
      writeFileSync(p, topicStub(t));
      created.push(rel(`${TOPICS_DIR}/${t.file}`));
    }
    pointers.push(topicPointer(t.file, t.hint));
  }

  const seg = currentMonth();
  const segPath = join(memoryDir, LOG_DIR, `${seg}.md`);
  if (!existsSync(segPath)) {
    writeFileSync(segPath, `# Log — ${seg}\n`);
    created.push(rel(`${LOG_DIR}/${seg}.md`));
  }

  if (!existsSync(indexPath(memoryDir))) {
    writeIndexModel(memoryDir, {
      project: name ? `${name} — describe with \`drevon memory learn\`.` : '',
      activeWork: '',
      topics: pointers,
      recentLog: [],
    });
    created.push(rel(INDEX_FILE));
  }

  return created;
}

// ── writers (append/patch only; never read Tier 2) ────────────────

/** Append a dated entry to the current month's log segment and refresh INDEX headlines. */
export function appendLog(memoryDir: string, text: string, date = today()): string {
  const seg = date.slice(0, 7);
  ensureDir(join(memoryDir, LOG_DIR));
  const segPath = join(memoryDir, LOG_DIR, `${seg}.md`);
  const headline = `${date} — ${text}`;
  const entry = `\n### ${headline}\n`;
  if (existsSync(segPath)) appendFileSync(segPath, entry);
  else writeFileSync(segPath, `# Log — ${seg}\n${entry}`);

  updateIndex(memoryDir, (m) => {
    m.recentLog = [headline, ...m.recentLog.filter((h) => h !== headline)].slice(0, MAX_RECENT_LOG);
    return m;
  });
  return headline;
}

/** Create a one-decision-per-file record under topics/decisions/ and refresh the INDEX pointer. */
export function addDecision(memoryDir: string, title: string, why?: string, date = today()): string {
  const dir = join(memoryDir, TOPICS_DIR, DECISIONS_DIR);
  ensureDir(dir);
  const file = `${date}-${slugify(title)}.md`;
  let body = `# ${title}\n\n- **Date:** ${date}\n`;
  if (why) body += `- **Why:** ${why}\n`;
  writeFileSync(join(dir, file), body);
  refreshDecisionsPointer(memoryDir);
  return `${TOPICS_DIR}/${DECISIONS_DIR}/${file}`;
}

/** Append a learning to a named topic file, ensuring its INDEX pointer exists. */
export function addLearning(
  memoryDir: string,
  text: string,
  topic = 'patterns',
  date = today(),
): string {
  const file = topic.endsWith('.md') ? topic : `${topic}.md`;
  ensureDir(join(memoryDir, TOPICS_DIR));
  const path = join(memoryDir, TOPICS_DIR, file);
  const entry = `\n- ${text} _(${date})_\n`;
  if (existsSync(path)) appendFileSync(path, entry);
  else writeFileSync(path, `# ${titleFromFile(file)}\n${entry}`);
  ensureTopicPointer(memoryDir, file);
  return `${TOPICS_DIR}/${file}`;
}

/** Set the Active Work block in INDEX (bounded, in place). */
export function setNote(memoryDir: string, text: string): void {
  updateIndex(memoryDir, (m) => {
    m.activeWork = text;
    return m;
  });
}

// ── stats ─────────────────────────────────────────────────────────

export interface MemoryStats {
  layout: DetectedLayout;
  files: number;
  totalTokens: number;
  tiers: { index: number; topics: number; log: number; archive: number };
}

function dirTokens(dir: string): { tokens: number; files: number } {
  if (!existsSync(dir)) return { tokens: 0, files: 0 };
  let tokens = 0;
  let files = 0;
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.md')) {
        tokens += estimateTokens(readFileSync(p, 'utf-8'));
        files += 1;
      }
    }
  };
  walk(dir);
  return { tokens, files };
}

export function memoryStats(memoryDir: string): MemoryStats {
  const layout = detectLayout(memoryDir);
  const idx = existsSync(indexPath(memoryDir))
    ? estimateTokens(readFileSync(indexPath(memoryDir), 'utf-8'))
    : 0;
  const topics = dirTokens(join(memoryDir, TOPICS_DIR));
  const log = dirTokens(join(memoryDir, LOG_DIR));
  const archive = dirTokens(join(memoryDir, ARCHIVE_DIR));

  // v1 fallback: count legacy top-level files as the (large) eager load.
  const legacy = layout === 'v1' ? dirTokens(memoryDir) : { tokens: 0, files: 0 };

  return {
    layout,
    files: (idx ? 1 : 0) + topics.files + log.files + archive.files + legacy.files,
    totalTokens: idx + topics.tokens + log.tokens + archive.tokens + legacy.tokens,
    tiers: { index: idx, topics: topics.tokens, log: log.tokens, archive: archive.tokens },
  };
}
