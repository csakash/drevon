import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createDefaultConfig } from '../../src/core/config.js';
import { compile } from '../../src/core/compiler.js';
import type { DrevonConfig } from '../../src/types.js';

function makeConfig(mode: 'hub' | 'project' = 'hub', agents = ['copilot', 'claude', 'cursor', 'codex'] as const): DrevonConfig {
  return createDefaultConfig(mode, 'test', {
    role: 'test-role',
    description: 'Test agent',
    posture: 'Be thorough',
    capabilities: ['engineering'],
  }, [...agents]);
}

describe('compiler', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates all agent files for hub config', () => {
    const config = makeConfig('hub');
    const result = compile(tmpDir, config);

    expect(result.created).toContain('.github/copilot-instructions.md');
    expect(result.created).toContain('CLAUDE.md');
    expect(result.created).toContain('AGENTS.md');
    expect(result.created.some((f: string) => f.startsWith('.cursor/rules/'))).toBe(true);
  });

  it('creates all agent files for project config', () => {
    const config = makeConfig('project');
    const result = compile(tmpDir, config);

    expect(result.created).toContain('.github/copilot-instructions.md');
    expect(result.created).toContain('CLAUDE.md');
    expect(result.created).toContain('AGENTS.md');
  });

  it('reports no changes on second compile', () => {
    const config = makeConfig('hub');
    compile(tmpDir, config);
    const result2 = compile(tmpDir, config);

    expect(result2.created).toHaveLength(0);
    expect(result2.updated).toHaveLength(0);
    expect(result2.unchanged.length).toBeGreaterThan(0);
  });

  it('only compiles enabled agents', () => {
    const config = makeConfig('hub', ['copilot']);
    const result = compile(tmpDir, config);

    expect(result.created).toContain('.github/copilot-instructions.md');
    expect(result.created).not.toContain('CLAUDE.md');
    expect(result.created).not.toContain('AGENTS.md');
  });
});
