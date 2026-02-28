import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initMemory } from '../../src/core/memory.js';

describe('memory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates hub memory files', () => {
    const created = initMemory(tmpDir, 'hub');
    expect(created).toContain('.drevon/memory/user.md');
    expect(created).toContain('.drevon/memory/projects.md');
    expect(created).toContain('.drevon/memory/systems.md');
    expect(created).toContain('.drevon/memory/log.md');
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'user.md'))).toBe(true);
  });

  it('creates project memory files', () => {
    const created = initMemory(tmpDir, 'project');
    expect(created).toContain('.drevon/memory/context.md');
    expect(created).toContain('.drevon/memory/decisions.md');
    expect(created).toContain('.drevon/memory/patterns.md');
    expect(created).toContain('.drevon/memory/log.md');
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'context.md'))).toBe(true);
  });

  it('replaces YYYY-MM-DD in log with current date', () => {
    initMemory(tmpDir, 'hub');
    const log = readFileSync(join(tmpDir, '.drevon', 'memory', 'log.md'), 'utf-8');
    expect(log).not.toContain('YYYY-MM-DD');
    expect(log).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('does not overwrite existing memory files', () => {
    initMemory(tmpDir, 'hub');
    const first = readFileSync(join(tmpDir, '.drevon', 'memory', 'user.md'), 'utf-8');

    const created = initMemory(tmpDir, 'hub');
    expect(created).toHaveLength(0);
    const second = readFileSync(join(tmpDir, '.drevon', 'memory', 'user.md'), 'utf-8');
    expect(first).toBe(second);
  });
});
