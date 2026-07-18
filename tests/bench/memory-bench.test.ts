import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { memoryStats } from '../../src/core/memory.js';
import { migrateMemory } from '../../src/core/memory-migrate.js';
import { searchMemory } from '../../src/core/memory-search.js';

// A benchmark that proves the headline claim: index+lazy loading collapses the
// eager (session-start) token cost versus the legacy read-everything layout,
// while lexical search still recalls the right file. It also prints a report.

describe('memory benchmark: eager token budget + retrieval', () => {
  let tmpDir: string;
  let memoryDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-bench-'));
    memoryDir = join(tmpDir, '.drevon', 'memory');
    mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  function writeConfig() {
    writeFileSync(
      join(tmpDir, 'drevon.config.json'),
      JSON.stringify(
        {
          version: 1,
          mode: 'project',
          name: 'BenchApp',
          identity: { role: 'Eng', description: 'd', posture: 'p', capabilities: [] },
          instructions: [{ id: 'memory-protocol', title: 'MP', content: 'read all' }],
          agents: { claude: { enabled: true } },
          memory: { enabled: true, directory: '.drevon/memory', files: {} },
          skills: { enabled: false, directory: '.drevon/skills', lockFile: 'skills-lock.json' },
          prompts: { enabled: false, directory: '.drevon/prompts' },
          workspace: { enabled: false },
        },
        null,
        2,
      ),
    );
  }

  it('cuts eager load by >=90% and still finds the needle', () => {
    writeConfig();

    // A realistic, aged v1 store: a large multi-month log dominates the size.
    const months = ['01', '02', '03', '04', '05', '06'];
    let log = '# Log\n\n';
    for (const m of months) {
      for (let d = 1; d <= 20; d++) {
        const day = String(d).padStart(2, '0');
        log +=
          `### 2026-${m}-${day} — Shipped feature ${m}${day} touching the auth and billing modules\n` +
          `Implementation detail describing the change to the ${m} subsystem in enough words to look real.\n\n`;
      }
    }
    writeFileSync(join(memoryDir, 'log.md'), log);
    writeFileSync(
      join(memoryDir, 'context.md'),
      '# Context\n\nBenchApp is a billing platform. Auth uses JWT. The needle: kafka event bus for invoicing.\n',
    );
    writeFileSync(join(memoryDir, 'patterns.md'), '# Patterns\n\n- Validate with zod.\n');
    writeFileSync(
      join(memoryDir, 'decisions.md'),
      '# Decisions\n\n### Decision: Use Kafka\nDate: 2026-03-01\nRationale: durable event bus\n',
    );

    // v1 eager load = everything (the old protocol read all files).
    const before = memoryStats(memoryDir);
    expect(before.layout).toBe('v1');

    migrateMemory(tmpDir);

    // v2 eager load = the index only.
    const after = memoryStats(memoryDir);
    expect(after.layout).toBe('v2');

    const eagerBefore = before.totalTokens;
    const eagerAfter = after.tiers.index;
    const reduction = 1 - eagerAfter / eagerBefore;

    // Retrieval sanity: the "needle" lives in context → topics/architecture.md.
    const hits = searchMemory(memoryDir, 'kafka event bus invoicing', 5);
    const topFiles = hits.map((h) => h.file);

    // eslint-disable-next-line no-console
    console.log(
      `\n  [memory-bench] eager load: ${eagerBefore.toLocaleString()} → ${eagerAfter.toLocaleString()} tokens ` +
        `(${(reduction * 100).toFixed(1)}% reduction)\n` +
        `  [memory-bench] total store: ${after.totalTokens.toLocaleString()} tokens across ${after.files} files\n` +
        `  [memory-bench] search "kafka event bus invoicing" → ${topFiles.join(', ')}\n`,
    );

    expect(eagerBefore).toBeGreaterThan(5000);
    expect(reduction).toBeGreaterThanOrEqual(0.9);
    expect(topFiles).toContain('topics/architecture.md');
  });
});
