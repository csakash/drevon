import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createDefaultConfig, writeConfig, loadConfig } from '../../src/core/config.js';

describe('config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates valid hub config', () => {
    const config = createDefaultConfig('hub', 'test-workspace', {
      role: 'founder-agent',
      description: 'Test',
      posture: 'Be bold',
      capabilities: ['engineering'],
    }, ['copilot', 'claude']);

    expect(config.mode).toBe('hub');
    expect(config.name).toBe('test-workspace');
    expect(config.workspace.enabled).toBe(true);
    expect(config.memory.files.user).toBeDefined();
    expect(config.memory.files.projects).toBeDefined();
  });

  it('creates valid project config', () => {
    const config = createDefaultConfig('project', 'my-app', {
      role: 'developer',
      description: 'Test dev',
      posture: 'Write tests',
      capabilities: ['engineering'],
    }, ['copilot']);

    expect(config.mode).toBe('project');
    expect(config.workspace.enabled).toBe(false);
    expect(config.memory.files.context).toBeDefined();
    expect(config.memory.files.decisions).toBeDefined();
  });

  it('round-trips config write/load', () => {
    const config = createDefaultConfig('hub', 'test', {
      role: 'test',
      description: 'test',
      posture: 'test',
      capabilities: [],
    }, ['copilot']);

    writeConfig(tmpDir, config);
    expect(existsSync(join(tmpDir, 'drevon.config.json'))).toBe(true);

    const loaded = loadConfig(tmpDir);
    expect(loaded.mode).toBe('hub');
    expect(loaded.name).toBe('test');
    expect(loaded.identity.role).toBe('test');
  });

  it('throws on missing config', () => {
    expect(() => loadConfig(tmpDir)).toThrow('Config not found');
  });
});
