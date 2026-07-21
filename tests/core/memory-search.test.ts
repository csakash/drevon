import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initMemory, appendLog, addLearning } from '../../src/core/memory.js';
import { searchMemory } from '../../src/core/memory-search.js';

describe('memory search (BM25)', () => {
  let tmpDir: string;
  let memoryDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-search-'));
    memoryDir = join(tmpDir, '.drevon', 'memory');
    mkdirSync(memoryDir, { recursive: true });
    initMemory(tmpDir, 'project', 'App');
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('ranks the topic containing the query terms first', () => {
    addLearning(memoryDir, 'Use Redis for rate limiting and caching', 'patterns', '2026-07-01');
    appendLog(memoryDir, 'Unrelated deployment note about DNS', '2026-07-02');
    const hits = searchMemory(memoryDir, 'redis caching');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].file).toBe('topics/patterns.md');
    expect(hits[0].snippet.toLowerCase()).toContain('redis');
  });

  it('returns nothing for an empty query', () => {
    expect(searchMemory(memoryDir, '   ')).toEqual([]);
  });

  it('respects the result limit', () => {
    for (let i = 0; i < 6; i++) addLearning(memoryDir, `topic ${i} mentions widgets`, `t${i}`, '2026-07-01');
    const hits = searchMemory(memoryDir, 'widgets', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});
