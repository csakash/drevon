import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { appendGitignore, isGitRepo, hasPackageJson, getProjectName } from '../../src/utils/git.js';

describe('git utils', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects .git directory', () => {
    expect(isGitRepo(tmpDir)).toBe(false);
    mkdirSync(join(tmpDir, '.git'));
    expect(isGitRepo(tmpDir)).toBe(true);
  });

  it('detects package.json', () => {
    expect(hasPackageJson(tmpDir)).toBe(false);
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    expect(hasPackageJson(tmpDir)).toBe(true);
  });

  it('gets project name from package.json', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{"name":"my-project"}');
    expect(getProjectName(tmpDir)).toBe('my-project');
  });

  it('falls back to directory name', () => {
    const name = getProjectName(tmpDir);
    expect(name).toBeTruthy();
  });

  it('appends to .gitignore', () => {
    appendGitignore(tmpDir, ['node_modules/', '.DS_Store']);
    const content = readFileSync(join(tmpDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.DS_Store');
  });

  it('does not duplicate .gitignore entries', () => {
    appendGitignore(tmpDir, ['node_modules/']);
    appendGitignore(tmpDir, ['node_modules/', 'dist/']);
    const content = readFileSync(join(tmpDir, '.gitignore'), 'utf-8');
    const count = (content.match(/node_modules\//g) || []).length;
    expect(count).toBe(1);
  });
});
