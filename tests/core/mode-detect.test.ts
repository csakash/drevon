import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectMode } from '../../src/core/mode-detect.js';

describe('mode-detect', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects project mode with .git/', () => {
    mkdirSync(join(tmpDir, '.git'));
    const result = detectMode(tmpDir);
    expect(result.suggested).toBe('project');
    expect(result.reason).toContain('existing codebase');
  });

  it('detects project mode with package.json', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    const result = detectMode(tmpDir);
    expect(result.suggested).toBe('project');
  });

  it('detects project mode with src/', () => {
    mkdirSync(join(tmpDir, 'src'));
    const result = detectMode(tmpDir);
    expect(result.suggested).toBe('project');
  });

  it('detects hub mode for empty directory', () => {
    const result = detectMode(tmpDir);
    expect(result.suggested).toBe('hub');
    expect(result.reason).toContain('Empty');
  });

  it('detects hub mode when workspace/ exists', () => {
    mkdirSync(join(tmpDir, 'workspace'));
    const result = detectMode(tmpDir);
    expect(result.suggested).toBe('hub');
    expect(result.reason).toContain('existing workspace');
  });
});
