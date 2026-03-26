import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, cpSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import pc from 'picocolors';
import { loadConfig, writeConfig, findProjectRoot } from '../core/config.js';
import { compile } from '../core/compiler.js';
import { migrateAgentsSkills } from '../core/skills.js';
import * as logger from '../utils/logger.js';
import { colors } from '../utils/logger.js';

interface InstalledSkill {
  name: string;
  description: string;
  source: string;
  path: string;
  hash: string;
  installedAt: string;
}

function readSkillsLock(dir: string): InstalledSkill[] {
  const lockPath = join(dir, 'skills-lock.json');
  if (!existsSync(lockPath)) return [];
  try {
    const data = JSON.parse(readFileSync(lockPath, 'utf-8'));
    return Array.isArray(data.skills) ? data.skills : [];
  } catch {
    return [];
  }
}

function writeSkillsLock(dir: string, skills: InstalledSkill[]): void {
  const lockPath = join(dir, 'skills-lock.json');
  writeFileSync(lockPath, JSON.stringify({ skills }, null, 2) + '\n');
}

function parseSkillSource(source: string): { repo: string; skill?: string; name: string } {
  // Strip URL prefix if present
  let cleaned = source
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/^https?:\/\/skills\.sh\//, '')
    .replace(/\.git$/, '');

  const parts = cleaned.split('/').filter(Boolean);

  if (parts.length >= 3) {
    // owner/repo/skill-name
    const repo = `${parts[0]}/${parts[1]}`;
    const skill = parts.slice(2).join('/');
    return { repo, skill, name: parts[parts.length - 1] };
  } else if (parts.length === 2) {
    // owner/repo
    return { repo: cleaned, name: parts[1] };
  }
  return { repo: cleaned, name: cleaned };
}

// Sanitize pasted input like "npx skills add https://github.com/owner/repo --skill name"
function sanitizeSkillInput(rawArgs: string[]): { source: string; skillFlag?: string } {
  // Join all args and strip leading "npx skills add" or "npx -y skills add"
  let joined = rawArgs.join(' ').trim();
  joined = joined.replace(/^npx\s+(-y\s+)?skills\s+add\s+/i, '');

  // Extract --skill flag if present
  let skillFlag: string | undefined;
  const skillMatch = joined.match(/--skill\s+(\S+)/);
  if (skillMatch) {
    skillFlag = skillMatch[1];
    joined = joined.replace(/--skill\s+\S+/, '').trim();
  }

  // Remove any other flags we don't recognize
  joined = joined.replace(/--\S+(\s+\S+)?/g, '').trim();

  return { source: joined, skillFlag };
}

/** Map drevon agent IDs to skills CLI agent names */
const SKILLS_CLI_AGENT_MAP: Record<string, string> = {
  copilot: 'github-copilot',
  claude: 'claude-code',
  cursor: 'cursor',
  codex: 'codex',
  windsurf: 'windsurf',
  cline: 'cline',
  continue: 'continue',
};

export interface SkillCommandOptions {
  verbose?: boolean;
}

export async function skillCommand(action: string, arg?: string, rawArgs?: string[], options?: SkillCommandOptions): Promise<void> {
  let cwd: string;
  try {
    cwd = findProjectRoot(process.cwd());
  } catch {
    logger.error('No drevon.config.json found. Run "drevon init" first.');
    process.exit(1);
  }

  switch (action) {
    case 'add': {
      // Sanitize: handle pasted "npx skills add ... --skill ..." and extract parts
      const sanitized = rawArgs ? sanitizeSkillInput(rawArgs) : arg ? sanitizeSkillInput([arg]) : null;
      if (!sanitized || !sanitized.source) {
        logger.error('Usage: drevon skill add <owner/repo/skill-name>');
        logger.info('Example: drevon skill add vercel-labs/skills/find-skills');
        logger.info('You can also paste directly from skills.sh: drevon skill add npx skills add https://github.com/owner/repo --skill name');
        process.exit(1);
      }

      const { repo, skill: parsedSkill, name: skillName } = parseSkillSource(sanitized.source);
      // --skill from pasted input takes priority, then parsed from path
      const effectiveSkill = sanitized.skillFlag || parsedSkill;
      const finalSkillName = effectiveSkill || skillName;

      // Check if skill is already installed
      const existingSkills = readSkillsLock(cwd);
      if (existingSkills.some((s) => s.name === finalSkillName)) {
        logger.warn(`Skill "${finalSkillName}" is already installed.`);
        logger.info('To reinstall, remove it first: drevon skill remove ' + finalSkillName);
        return;
      }

      try {
        logger.info(`Installing skill: ${effectiveSkill || skillName}...`);
        const skillFlag = effectiveSkill ? ` --skill ${effectiveSkill}` : '';

        // Build agent flags from drevon config, defaulting to 'universal'
        let agentFlags = ' -a universal';
        try {
          const config = loadConfig(cwd);
          const enabledAgents = Object.entries(config.agents)
            .filter(([, v]) => v?.enabled)
            .map(([k]) => SKILLS_CLI_AGENT_MAP[k])
            .filter(Boolean);
          if (enabledAgents.length > 0) {
            agentFlags = enabledAgents.map((a) => ` -a ${a}`).join('');
          }
        } catch {
          // Config not available, fall back to universal
        }

        // Non-interactive: -y skips all prompts, -a targets specific agents
        const cmd = `npx -y skills add ${repo}${skillFlag}${agentFlags} -y`;

        if (options?.verbose) {
          execSync(cmd, { cwd, stdio: 'inherit' });
        } else {
          execSync(cmd, { cwd, stdio: 'pipe' });
        }
      } catch (err) {
        const stderr = err instanceof Error && 'stderr' in err ? String((err as any).stderr) : '';
        const stdout = err instanceof Error && 'stdout' in err ? String((err as any).stdout) : '';
        logger.error(`Failed to install skill: ${sanitized.source}`);
        if (stderr) logger.info(stderr.trim());
        if (stdout) logger.info(stdout.trim());
        logger.info('Run with --verbose for full output, or check: npx skills --help');
        process.exit(1);
      }

      // Copy skill from .agents/skills/ to .drevon/skills/ if needed
      const drevonSkillDir = join(cwd, '.drevon', 'skills', finalSkillName);
      const agentsSkillDir = join(cwd, '.agents', 'skills', finalSkillName);
      if (!existsSync(drevonSkillDir) && existsSync(agentsSkillDir)) {
        mkdirSync(drevonSkillDir, { recursive: true });
        cpSync(agentsSkillDir, drevonSkillDir, { recursive: true });
        logger.info(`Copied skill to .drevon/skills/${finalSkillName}/`);
      }

      // Try to read skill info from common install locations
      let description = '';
      const searchDirs = [
        join(cwd, '.drevon', 'skills', finalSkillName),
        join(cwd, '.agents', 'skills', finalSkillName),
      ];
      for (const skillDir of searchDirs) {
        const skillMdPath = join(skillDir, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const content = readFileSync(skillMdPath, 'utf-8');
          const descMatch = content.match(/^description:\s*(.+)$/m);
          if (descMatch) description = descMatch[1].trim();
          break;
        }
      }

      // Update lock
      const skills = readSkillsLock(cwd);
      const existing = skills.findIndex((s) => s.name === finalSkillName);
      const entry: InstalledSkill = {
        name: finalSkillName,
        description,
        source: sanitized.source,
        path: `.drevon/skills/${finalSkillName}`,
        hash: '',
        installedAt: new Date().toISOString(),
      };
      if (existing >= 0) {
        skills[existing] = entry;
      } else {
        skills.push(entry);
      }
      writeSkillsLock(cwd, skills);

      // Migrate any untracked .agents/skills/ → .drevon/skills/ before compiling
      const migrated = migrateAgentsSkills(cwd);
      for (const name of migrated) {
        logger.info(`Migrated skill from .agents/skills/${name} → .drevon/skills/${name}`);
      }

      // Re-sync agent configs
      try {
        const config = loadConfig(cwd);
        compile(cwd, config);
        logger.success(`Skill "${finalSkillName}" installed and agent configs updated.`);
      } catch {
        logger.success(`Skill "${finalSkillName}" installed.`);
      }
      break;
    }

    case 'remove': {
      if (!arg) {
        logger.error('Usage: drevon skill remove <name>');
        process.exit(1);
      }

      const skillDir = join(cwd, '.drevon', 'skills', arg);
      const agentsSkillDir = join(cwd, '.agents', 'skills', arg);
      const skills = readSkillsLock(cwd);
      const inLock = skills.some((s) => s.name === arg);

      if (!existsSync(skillDir) && !existsSync(agentsSkillDir) && !inLock) {
        logger.error(`Skill "${arg}" is not installed.`);
        process.exit(1);
      }

      if (existsSync(skillDir)) {
        rmSync(skillDir, { recursive: true });
      }
      if (existsSync(agentsSkillDir)) {
        rmSync(agentsSkillDir, { recursive: true });
      }

      const filtered = skills.filter((s) => s.name !== arg);
      writeSkillsLock(cwd, filtered);

      try {
        const config = loadConfig(cwd);
        compile(cwd, config);
      } catch {
        // ignore
      }

      logger.success(`Skill "${arg}" removed.`);
      break;
    }

    case 'list': {
      const skills = readSkillsLock(cwd);
      if (skills.length === 0) {
        logger.info('No skills installed. Install with: drevon skill add <owner/repo>');
        return;
      }
      console.log();
      console.log(pc.dim('  ┌ ') + colors.orangeBold('Installed skills'));
      console.log(pc.dim('  │'));
      for (const s of skills) {
        console.log(pc.dim('  │ ') + `${colors.orange('●')} ${colors.yellowBold(s.name)} ${pc.dim('—')} ${pc.dim(s.description || s.source)}`);
      }
      console.log(pc.dim('  └'));
      console.log();
      break;
    }

    case 'sync': {
      // Migrate .agents/skills/ → .drevon/skills/ if any exist
      const migrated = migrateAgentsSkills(cwd);
      for (const name of migrated) {
        logger.info(`Migrated skill from .agents/skills/${name} → .drevon/skills/${name}`);
      }

      try {
        const config = loadConfig(cwd);
        const result = compile(cwd, config);
        for (const f of result.updated) {
          logger.fileUpdated(f);
        }
        logger.success('Skills synced into agent configs.');
      } catch (err) {
        logger.error((err as Error).message);
        process.exit(1);
      }
      break;
    }

    default:
      logger.error(`Unknown skill action: ${action}. Use add, remove, list, or sync.`);
      process.exit(1);
  }
}
