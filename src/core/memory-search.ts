import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, relative } from 'path';
import { TOPICS_DIR, LOG_DIR, INDEX_FILE } from './memory.js';

export interface SearchHit {
  file: string; // path relative to the memory dir
  score: number;
  snippet: string;
}

interface Doc {
  file: string;
  lines: string[];
  tokens: string[];
  length: number;
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on', 'with',
  'as', 'at', 'by', 'be', 'this', 'that', 'we', 'our', 'you', 'your',
]);

const K1 = 1.5;
const B = 0.75;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

function collectDocs(memoryDir: string): Doc[] {
  const docs: Doc[] = [];
  const roots = [join(memoryDir, TOPICS_DIR), join(memoryDir, LOG_DIR), join(memoryDir, INDEX_FILE)];

  const addFile = (abs: string) => {
    const text = readFileSync(abs, 'utf-8');
    const tokens = tokenize(text);
    docs.push({ file: relative(memoryDir, abs), lines: text.split('\n'), tokens, length: tokens.length });
  };

  const walk = (p: string) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) walk(join(p, name));
    } else if (p.endsWith('.md')) {
      addFile(p);
    }
  };

  for (const r of roots) walk(r);
  return docs;
}

function snippetFor(doc: Doc, queryTokens: string[]): string {
  const qset = new Set(queryTokens);
  for (const line of doc.lines) {
    const t = tokenize(line);
    if (t.some((tok) => qset.has(tok))) {
      const trimmed = line.trim().replace(/^#{1,6}\s*/, '');
      if (trimmed) return trimmed.length > 140 ? trimmed.slice(0, 137) + '…' : trimmed;
    }
  }
  const first = doc.lines.find((l) => l.trim());
  return first ? first.trim().replace(/^#{1,6}\s*/, '') : '';
}

/** BM25 lexical search over topics, log segments, and the index. No embeddings, no network. */
export function searchMemory(memoryDir: string, query: string, limit = 10): SearchHit[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const docs = collectDocs(memoryDir);
  if (docs.length === 0) return [];

  const N = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.length, 0) / N || 1;

  // document frequency per query term
  const df = new Map<string, number>();
  for (const qt of new Set(queryTokens)) {
    df.set(qt, docs.filter((d) => d.tokens.includes(qt)).length);
  }

  const hits: SearchHit[] = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const tok of doc.tokens) tf.set(tok, (tf.get(tok) ?? 0) + 1);

    let score = 0;
    for (const qt of new Set(queryTokens)) {
      const f = tf.get(qt) ?? 0;
      if (f === 0) continue;
      const n = df.get(qt) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / avgdl)));
    }
    return { file: doc.file, score, snippet: snippetFor(doc, queryTokens) };
  });

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
