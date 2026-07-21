import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { compactMemory } from '../../src/core/memory-compact.js';
import { initMemory, appendLog, currentMonth } from '../../src/core/memory.js';

function monthOffset(base: string, delta: number): string {
  const [y, m] = base.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('memory compaction', () => {
  let tmpDir: string;
  let memoryDir: string;

  function writeConfig(retentionMonths = 3) {
    writeFileSync(
      join(tmpDir, 'drevon.config.json'),
      JSON.stringify(
        {
          version: 2,
          mode: 'project',
          name: 'App',
          identity: { role: 'Eng', description: 'd', posture: 'p', capabilities: [] },
          instructions: [],
          agents: { claude: { enabled: true } },
          memory: {
            enabled: true,
            directory: '.drevon/memory',
            files: {},
            layout: 'v2',
            retentionMonths,
          },
          skills: { enabled: false, directory: '.drevon/skills', lockFile: 'skills-lock.json' },
          prompts: { enabled: false, directory: '.drevon/prompts' },
          workspace: { enabled: false },
        },
        null,
        2,
      ),
    );
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-compact-'));
    memoryDir = join(tmpDir, '.drevon', 'memory');
    mkdirSync(memoryDir, { recursive: true });
  });

  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('rolls months older than the retention window into summaries + archive', () => {
    writeConfig(3);
    initMemory(tmpDir, 'project', 'App');
    const cur = currentMonth();
    const old = monthOffset(cur, -5); // 5 months back → beyond a 3-month window
    appendLog(memoryDir, 'Ancient event', `${old}-05`);
    appendLog(memoryDir, 'Recent event'); // current month

    const result = compactMemory(tmpDir);

    expect(result.rotatedMonths).toContain(old);
    expect(existsSync(join(memoryDir, 'log', `${old}.md`))).toBe(false); // rotated out
    expect(existsSync(join(memoryDir, 'archive', 'log', `${old}.md`))).toBe(true); // preserved
    const summaries = readFileSync(join(memoryDir, 'log', 'summaries.md'), 'utf-8');
    expect(summaries).toContain(`## ${old}`);
    expect(summaries).toContain('Ancient event');
  });

  it('leaves recent months untouched', () => {
    writeConfig(3);
    initMemory(tmpDir, 'project', 'App');
    appendLog(memoryDir, 'Recent event');
    const result = compactMemory(tmpDir);
    expect(result.rotatedMonths).toHaveLength(0);
    expect(existsSync(join(memoryDir, 'log', `${currentMonth()}.md`))).toBe(true);
  });

  it('is non-destructive — archived bodies retain the original content', () => {
    writeConfig(3);
    initMemory(tmpDir, 'project', 'App');
    const cur = currentMonth();
    const old = monthOffset(cur, -6);
    appendLog(memoryDir, 'Preserve me exactly', `${old}-09`);
    compactMemory(tmpDir);
    const archived = readFileSync(join(memoryDir, 'archive', 'log', `${old}.md`), 'utf-8');
    expect(archived).toContain('Preserve me exactly');
  });
});
