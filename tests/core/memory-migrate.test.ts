import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { migrateMemory, upgradeConfigToV2 } from '../../src/core/memory-migrate.js';
import { detectLayout } from '../../src/core/memory.js';
import type { DrevonConfig } from '../../src/types.js';

function baseConfig(overrides: Partial<DrevonConfig> = {}): DrevonConfig {
  return {
    version: 1,
    mode: 'project',
    name: 'TestApp',
    identity: { role: 'Engineer', description: 'd', posture: 'p', capabilities: [] },
    instructions: [
      { id: 'memory-protocol', title: 'Memory Protocol', content: 'read all' },
      { id: 'git-workflow', title: 'Git', content: 'use git' },
    ],
    agents: { claude: { enabled: true } },
    memory: { enabled: true, directory: '.drevon/memory', files: {} },
    skills: { enabled: false, directory: '.drevon/skills', lockFile: 'skills-lock.json' },
    prompts: { enabled: false, directory: '.drevon/prompts' },
    workspace: { enabled: false },
    ...overrides,
  };
}

describe('memory migration v1 → v2', () => {
  let tmpDir: string;
  let memoryDir: string;

  function writeV1(config: DrevonConfig, files: Record<string, string>) {
    writeFileSync(join(tmpDir, 'drevon.config.json'), JSON.stringify(config, null, 2));
    mkdirSync(memoryDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(memoryDir, name), content);
    }
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-migrate-'));
    memoryDir = join(tmpDir, '.drevon', 'memory');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('splits legacy files into the v2 layout', () => {
    writeV1(baseConfig(), {
      'context.md': '# Context\n\nAn app.',
      'patterns.md': '# Patterns\n\n- tabs',
      'decisions.md':
        '# Decisions\n\n### Decision: Use Postgres\nDate: 2026-05-01\n\n### Decision: Use React\nDate: 2026-06-02\n',
      'log.md': '# Log\n\n### 2026-05-01 — First\ndetail\n\n### 2026-06-02 — Second\ndetail\n',
    });

    const result = migrateMemory(tmpDir);
    expect(result.status).toBe('migrated');
    expect(detectLayout(memoryDir)).toBe('v2');

    expect(existsSync(join(memoryDir, 'INDEX.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'topics', 'architecture.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'topics', 'patterns.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'topics', 'decisions', '2026-05-01-use-postgres.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'topics', 'decisions', '2026-06-02-use-react.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'log', '2026-05.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'log', '2026-06.md'))).toBe(true);
  });

  it('backs up originals non-destructively and removes them from the root', () => {
    writeV1(baseConfig(), { 'context.md': '# Context\n\noriginal content' });
    const result = migrateMemory(tmpDir);
    // originals moved out of the root...
    expect(existsSync(join(memoryDir, 'context.md'))).toBe(false);
    // ...but preserved verbatim in the backup (result.backupDir is workspace-relative)
    const backupFile = join(tmpDir, result.backupDir!, 'context.md');
    expect(readFileSync(backupFile, 'utf-8')).toBe('# Context\n\noriginal content');
  });

  it('rewrites the config to the v2 shape and strips the legacy protocol instruction', () => {
    writeV1(baseConfig(), { 'context.md': '# Context' });
    migrateMemory(tmpDir);
    const config = JSON.parse(readFileSync(join(tmpDir, 'drevon.config.json'), 'utf-8'));
    expect(config.version).toBe(2);
    expect(config.memory.layout).toBe('v2');
    expect(config.instructions.map((i: { id: string }) => i.id)).toEqual(['git-workflow']);
  });

  it('is idempotent — a v2 store returns already-v2', () => {
    writeV1(baseConfig(), { 'context.md': '# Context' });
    migrateMemory(tmpDir);
    const second = migrateMemory(tmpDir);
    expect(second.status).toBe('already-v2');
  });

  it('returns nothing-to-migrate on an empty memory dir', () => {
    writeFileSync(join(tmpDir, 'drevon.config.json'), JSON.stringify(baseConfig(), null, 2));
    mkdirSync(memoryDir, { recursive: true });
    expect(migrateMemory(tmpDir).status).toBe('nothing-to-migrate');
  });

  it('dry-run computes a plan without writing', () => {
    writeV1(baseConfig(), { 'context.md': '# Context', 'log.md': '### 2026-06-01 — x\n' });
    const result = migrateMemory(tmpDir, { dryRun: true });
    expect(result.moves.length).toBeGreaterThan(0);
    expect(existsSync(join(memoryDir, 'INDEX.md'))).toBe(false);
    expect(existsSync(join(memoryDir, 'context.md'))).toBe(true); // untouched
  });

  it('preserves unparseable decisions as a legacy file', () => {
    writeV1(baseConfig(), { 'decisions.md': 'just some free text, no headings at all' });
    migrateMemory(tmpDir);
    expect(existsSync(join(memoryDir, 'topics', 'decisions', 'legacy.md'))).toBe(true);
  });

  it('maps hub files to hub topics', () => {
    writeV1(baseConfig({ mode: 'hub' }), {
      'user.md': '# User',
      'projects.md': '# Projects',
      'systems.md': '# Systems',
    });
    migrateMemory(tmpDir);
    expect(existsSync(join(memoryDir, 'topics', 'user.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'topics', 'projects.md'))).toBe(true);
    expect(existsSync(join(memoryDir, 'topics', 'systems.md'))).toBe(true);
  });

  it('upgradeConfigToV2 is pure and version-safe', () => {
    const cfg = upgradeConfigToV2(baseConfig());
    expect(cfg.version).toBe(2);
    expect(cfg.memory.layout).toBe('v2');
    expect(cfg.memory.indexFile).toBe('.drevon/memory/INDEX.md');
  });
});
