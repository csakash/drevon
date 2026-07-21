import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  initMemory,
  appendLog,
  addDecision,
  addLearning,
  setNote,
  memoryStats,
  detectLayout,
  parseIndex,
  renderIndex,
  estimateTokens,
  DEFAULT_EAGER_BUDGET_TOKENS,
} from '../../src/core/memory.js';

describe('memory v2 store', () => {
  let tmpDir: string;
  let memoryDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
    memoryDir = join(tmpDir, '.drevon', 'memory');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('initMemory', () => {
    it('scaffolds the v2 project layout', () => {
      const created = initMemory(tmpDir, 'project', 'MyApp');
      expect(created).toContain('.drevon/memory/INDEX.md');
      expect(created).toContain('.drevon/memory/topics/architecture.md');
      expect(created).toContain('.drevon/memory/topics/patterns.md');
      expect(existsSync(join(memoryDir, 'INDEX.md'))).toBe(true);
      expect(existsSync(join(memoryDir, 'topics', 'decisions'))).toBe(true);
      expect(existsSync(join(memoryDir, 'log'))).toBe(true);
      expect(existsSync(join(memoryDir, 'archive'))).toBe(true);
    });

    it('scaffolds the v2 hub layout', () => {
      const created = initMemory(tmpDir, 'hub', 'MyHub');
      expect(created).toContain('.drevon/memory/topics/user.md');
      expect(created).toContain('.drevon/memory/topics/projects.md');
      expect(created).toContain('.drevon/memory/topics/systems.md');
    });

    it('is idempotent — a second run creates nothing', () => {
      initMemory(tmpDir, 'project', 'MyApp');
      const first = readFileSync(join(memoryDir, 'INDEX.md'), 'utf-8');
      const created = initMemory(tmpDir, 'project', 'MyApp');
      expect(created).toHaveLength(0);
      expect(readFileSync(join(memoryDir, 'INDEX.md'), 'utf-8')).toBe(first);
    });

    it('detects the v2 layout', () => {
      expect(detectLayout(memoryDir)).toBe('none');
      initMemory(tmpDir, 'project', 'MyApp');
      expect(detectLayout(memoryDir)).toBe('v2');
    });
  });

  describe('writers', () => {
    beforeEach(() => initMemory(tmpDir, 'project', 'MyApp'));

    it('appendLog writes a dated segment and updates the index headline', () => {
      appendLog(memoryDir, 'Did a thing', '2026-07-18');
      const seg = readFileSync(join(memoryDir, 'log', '2026-07.md'), 'utf-8');
      expect(seg).toContain('### 2026-07-18 — Did a thing');
      const index = parseIndex(readFileSync(join(memoryDir, 'INDEX.md'), 'utf-8'));
      expect(index.recentLog[0]).toBe('2026-07-18 — Did a thing');
    });

    it('appendLog groups entries into monthly segments', () => {
      appendLog(memoryDir, 'June thing', '2026-06-02');
      appendLog(memoryDir, 'July thing', '2026-07-02');
      expect(existsSync(join(memoryDir, 'log', '2026-06.md'))).toBe(true);
      expect(existsSync(join(memoryDir, 'log', '2026-07.md'))).toBe(true);
    });

    it('keeps only the most recent headlines in the index', () => {
      for (let d = 1; d <= 8; d++) {
        appendLog(memoryDir, `Entry ${d}`, `2026-07-0${d}`);
      }
      const index = parseIndex(readFileSync(join(memoryDir, 'INDEX.md'), 'utf-8'));
      expect(index.recentLog.length).toBeLessThanOrEqual(5);
      expect(index.recentLog[0]).toBe('2026-07-08 — Entry 8');
    });

    it('addDecision writes one file per decision and updates the pointer', () => {
      const rel = addDecision(memoryDir, 'Use Postgres', 'reliability', '2026-07-18');
      expect(rel).toBe('topics/decisions/2026-07-18-use-postgres.md');
      const body = readFileSync(join(memoryDir, rel), 'utf-8');
      expect(body).toContain('# Use Postgres');
      expect(body).toContain('**Why:** reliability');
      const index = readFileSync(join(memoryDir, 'INDEX.md'), 'utf-8');
      expect(index).toContain('1 decision (latest: Use Postgres)');
    });

    it('addLearning appends to a topic and ensures a pointer', () => {
      addLearning(memoryDir, 'Prefer tabs', 'patterns', '2026-07-18');
      const topic = readFileSync(join(memoryDir, 'topics', 'patterns.md'), 'utf-8');
      expect(topic).toContain('- Prefer tabs');
      const index = parseIndex(readFileSync(join(memoryDir, 'INDEX.md'), 'utf-8'));
      expect(index.topics.some((t) => t.includes('topics/patterns.md'))).toBe(true);
    });

    it('addLearning creates a brand-new topic file when needed', () => {
      const rel = addLearning(memoryDir, 'A gotcha', 'gotchas', '2026-07-18');
      expect(rel).toBe('topics/gotchas.md');
      expect(existsSync(join(memoryDir, 'topics', 'gotchas.md'))).toBe(true);
    });

    it('setNote updates the active-work block', () => {
      setNote(memoryDir, 'Shipping v2');
      const index = parseIndex(readFileSync(join(memoryDir, 'INDEX.md'), 'utf-8'));
      expect(index.activeWork).toBe('Shipping v2');
    });
  });

  describe('index budget', () => {
    it('trims the recent-log tail to respect the eager budget', () => {
      const model = {
        project: 'x'.repeat(200),
        activeWork: 'y'.repeat(200),
        topics: Array.from({ length: 40 }, (_, i) => `- [T${i}](topics/t${i}.md) — hint`),
        recentLog: Array.from({ length: 5 }, (_, i) => `2026-07-0${i} — headline ${i}`),
      };
      const full = estimateTokens(renderIndex(model, 100000));
      const trimmed = estimateTokens(renderIndex(model, 200));
      expect(trimmed).toBeLessThan(full);
    });

    it('round-trips through parse/render', () => {
      const model = {
        project: 'A project',
        activeWork: 'Doing work',
        topics: ['- [Architecture](topics/architecture.md) — hint'],
        recentLog: ['2026-07-18 — did a thing'],
      };
      const parsed = parseIndex(renderIndex(model, DEFAULT_EAGER_BUDGET_TOKENS));
      expect(parsed.project).toBe('A project');
      expect(parsed.activeWork).toBe('Doing work');
      expect(parsed.topics).toEqual(model.topics);
      expect(parsed.recentLog).toEqual(model.recentLog);
    });
  });

  describe('memoryStats', () => {
    it('reports a small eager load for a fresh v2 store', () => {
      initMemory(tmpDir, 'project', 'MyApp');
      const stats = memoryStats(memoryDir);
      expect(stats.layout).toBe('v2');
      expect(stats.tiers.index).toBeGreaterThan(0);
      expect(stats.tiers.index).toBeLessThan(DEFAULT_EAGER_BUDGET_TOKENS);
    });
  });
});
