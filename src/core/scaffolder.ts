import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pc from 'picocolors';
import type { InitOptions, AgentId } from '../types.js';
import { createDefaultConfig, writeConfig } from './config.js';
import { initMemory } from './memory.js';
import { initPrompts } from './prompts.js';
import { compile } from './compiler.js';
import { appendGitignore } from '../utils/git.js';
import * as logger from '../utils/logger.js';
import { colors } from '../utils/logger.js';

function getBundledSkillPath(skillName: string, fileName: string): string | null {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const candidates = [
    join(__dirname, 'templates', 'skills', skillName, fileName),
    join(__dirname, '..', 'templates', 'skills', skillName, fileName),
    join(__dirname, '..', 'src', 'templates', 'skills', skillName, fileName),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export async function scaffold(dir: string, options: InitOptions): Promise<void> {
  const {
    mode,
    name,
    identity,
    agents,
    enableMemory,
    enableSkills,
    enablePrompts,
    includeStarterPrompts,
  } = options;

  logger.header(mode === 'hub' ? 'drevon — AI Native Workspace' : 'drevon — AI Native Project');

  // 1. Create config
  const config = createDefaultConfig(mode, name, identity, agents);
  config.memory.enabled = enableMemory;
  config.skills.enabled = enableSkills;
  config.prompts.enabled = enablePrompts;

  writeConfig(dir, config);
  logger.fileCreated('drevon.config.json');

  // 2. Create .drevon/ directory
  mkdirSync(join(dir, '.drevon'), { recursive: true });

  // 3. Initialize memory
  if (enableMemory) {
    const memoryFiles = initMemory(dir, mode);
    for (const f of memoryFiles) {
      logger.fileCreated(f);
    }
  }

  // 4. Initialize prompts
  if (enablePrompts) {
    const promptFiles = await initPrompts(dir, includeStarterPrompts);
    for (const f of promptFiles) {
      logger.fileCreated(f);
    }
  }

  // 5. Create skills infrastructure
  if (enableSkills) {
    const skillsDir = join(dir, '.drevon', 'skills');
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
    }

    // Auto-install find-skills (bundled, no network needed)
    const findSkillsDir = join(dir, '.drevon', 'skills', 'find-skills');
    if (!existsSync(findSkillsDir)) {
      mkdirSync(findSkillsDir, { recursive: true });
      const bundledSkill = getBundledSkillPath('find-skills', 'SKILL.md');
      if (bundledSkill) {
        copyFileSync(bundledSkill, join(findSkillsDir, 'SKILL.md'));
      }
    }
    logger.fileCreated('.drevon/skills/find-skills/');

    const lockPath = join(dir, 'skills-lock.json');
    const lockData = {
      skills: [
        {
          name: 'find-skills',
          description: 'Helps users discover and install agent skills from the open agent skills ecosystem.',
          source: 'vercel-labs/skills/find-skills',
          path: '.drevon/skills/find-skills',
          hash: '',
          installedAt: new Date().toISOString(),
        },
      ],
    };
    writeFileSync(lockPath, JSON.stringify(lockData, null, 2) + '\n');
    logger.fileCreated('skills-lock.json');
  }

  // 6. Hub mode: create workspace/
  if (mode === 'hub') {
    const wsDir = join(dir, 'workspace');
    if (!existsSync(wsDir)) {
      mkdirSync(wsDir, { recursive: true });
      writeFileSync(join(wsDir, '.gitkeep'), '');
      logger.fileCreated('workspace/');
    }
  }

  // 7. Compile all agent configs
  const result = compile(dir, config);
  for (const f of result.created) {
    logger.fileCreated(f);
  }
  for (const f of result.updated) {
    logger.fileUpdated(f);
  }

  // 8. Append to .gitignore
  appendGitignore(dir, [
    '.drevon/skills/*/node_modules/',
    '.aider.chat.history.md',
    '.aider.input.history',
    '.aider.tags.cache.v3/',
  ]);
  logger.fileUpdated('.gitignore');

  // 9. Print summary
  const agentList = agents.map((a) => a).join(', ');
  logger.footer(
    mode === 'hub' ? 'Hub workspace ready!' : 'Project initialized!',
  );

  console.log();
  console.log(colors.orangeBold('  Next steps'));
  console.log(pc.dim('  ─────────────────────────────────────'));
  if (mode === 'hub') {
    console.log(`  ${pc.dim('›')} Open this folder in ${colors.yellow('VS Code')}, ${colors.yellow('Cursor')}, or your IDE`);
    console.log(`  ${pc.dim('›')} Or run ${colors.yellow('claude')} / ${colors.yellow('codex')} in your terminal`);
  } else {
    console.log(`  ${pc.dim('›')} Your agent now has ${colors.yellow('memory')} and ${colors.yellow('custom instructions')} for this codebase`);
    console.log(`  ${pc.dim('›')} Open in ${colors.yellow('VS Code/Cursor')} or run ${colors.yellow('claude')} / ${colors.yellow('codex')}`);
  }
  console.log(`  ${pc.dim('›')} Edit ${colors.yellow('drevon.config.json')} to customize, then run ${colors.yellow('drevon sync')}`);
  console.log(`  ${pc.dim('›')} Agents: ${colors.orangeBold(agentList)}`);
  console.log();
}
