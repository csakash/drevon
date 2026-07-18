import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scaffold } from '../../src/core/scaffolder.js';
import type { InitOptions } from '../../src/types.js';

describe('init hub mode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates all expected hub files', async () => {
    const options: InitOptions = {
      mode: 'hub',
      name: 'test-hub',
      identity: {
        role: 'founder-agent',
        description: 'Test hub agent',
        posture: 'Be bold',
        capabilities: ['engineering'],
      },
      agents: ['copilot', 'claude', 'cursor'],
      enableMemory: true,
      enableSkills: true,
      enablePrompts: true,
      includeStarterPrompts: true,
    };

    await scaffold(tmpDir, options);

    // Core files
    expect(existsSync(join(tmpDir, 'drevon.config.json'))).toBe(true);
    expect(existsSync(join(tmpDir, 'skills-lock.json'))).toBe(true);

    // Memory files (v2 layout: index + lazy topics)
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'INDEX.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'topics', 'user.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'topics', 'projects.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'topics', 'systems.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'log'))).toBe(true);

    // Skills - find-skills auto-installed
    expect(existsSync(join(tmpDir, '.drevon', 'skills', 'find-skills', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'skills-lock.json'))).toBe(true);
    const lock = JSON.parse(readFileSync(join(tmpDir, 'skills-lock.json'), 'utf-8'));
    expect(lock.skills[0].name).toBe('find-skills');

    // Agent files
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.cursor', 'rules', 'core.mdc'))).toBe(true);

    // Workspace
    expect(existsSync(join(tmpDir, 'workspace', '.gitkeep'))).toBe(true);

    // Prompts
    expect(existsSync(join(tmpDir, '.drevon', 'prompts', '_index.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'prompts', 'code-review.md'))).toBe(true);

    // Only specified agents in config
    const config = JSON.parse(readFileSync(join(tmpDir, 'drevon.config.json'), 'utf-8'));
    expect(Object.keys(config.agents)).toEqual(['copilot', 'claude', 'cursor']);
  });
});

describe('init project mode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'drevon-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates project-specific files', async () => {
    const options: InitOptions = {
      mode: 'project',
      name: 'my-app',
      identity: {
        role: 'senior-developer',
        description: 'Test dev agent',
        posture: 'Write tested code',
        capabilities: ['engineering'],
      },
      agents: ['copilot', 'claude'],
      enableMemory: true,
      enableSkills: true,
      enablePrompts: true,
      includeStarterPrompts: false,
    };

    await scaffold(tmpDir, options);

    // Project memory files (v2 layout: index + lazy topics)
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'INDEX.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'topics', 'architecture.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'topics', 'patterns.md'))).toBe(true);
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'topics', 'decisions'))).toBe(true);

    // No workspace directory
    expect(existsSync(join(tmpDir, 'workspace'))).toBe(false);

    // No hub-specific memory topics
    expect(existsSync(join(tmpDir, '.drevon', 'memory', 'topics', 'user.md'))).toBe(false);

    // Config is project mode with only specified agents
    const config = JSON.parse(readFileSync(join(tmpDir, 'drevon.config.json'), 'utf-8'));
    expect(config.mode).toBe('project');
    expect(config.workspace.enabled).toBe(false);
    expect(Object.keys(config.agents)).toEqual(['copilot', 'claude']);
  });
});
