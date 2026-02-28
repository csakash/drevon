export interface InstalledSkill {
  name: string;
  description: string;
  source: string;
  path: string;
  hash: string;
  installedAt: string;
}

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync } from 'fs';
import { join } from 'path';

export function readSkillsLock(dir: string): InstalledSkill[] {
  const lockPath = join(dir, 'skills-lock.json');
  if (!existsSync(lockPath)) return [];
  try {
    const data = JSON.parse(readFileSync(lockPath, 'utf-8'));
    return Array.isArray(data.skills) ? data.skills : [];
  } catch {
    return [];
  }
}

export function writeSkillsLock(dir: string, skills: InstalledSkill[]): void {
  const lockPath = join(dir, 'skills-lock.json');
  writeFileSync(lockPath, JSON.stringify({ skills }, null, 2) + '\n');
}

export function scanSkills(dir: string): InstalledSkill[] {
  const skillsDir = join(dir, '.drevon', 'skills');
  if (!existsSync(skillsDir)) return [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const skills: InstalledSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const skillPath = join(skillsDir, entry.name);
    const skillMd = join(skillPath, 'SKILL.md');

    let description = '';
    if (existsSync(skillMd)) {
      const content = readFileSync(skillMd, 'utf-8');
      const match = content.match(/^description:\s*(.+)$/m);
      if (match) description = match[1].trim();
    }

    skills.push({
      name: entry.name,
      description,
      source: '',
      path: `.drevon/skills/${entry.name}`,
      hash: '',
      installedAt: '',
    });
  }

  return skills;
}

/**
 * Migrate skills from .agents/skills/ to .drevon/skills/ and register in lock file.
 * Returns names of migrated skills.
 */
export function migrateAgentsSkills(dir: string): string[] {
  const agentsSkillsDir = join(dir, '.agents', 'skills');
  if (!existsSync(agentsSkillsDir)) return [];

  const entries = readdirSync(agentsSkillsDir, { withFileTypes: true });
  const migrated: string[] = [];
  const existing = readSkillsLock(dir);
  let updated = false;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const drevonDest = join(dir, '.drevon', 'skills', entry.name);
    const agentsSrc = join(agentsSkillsDir, entry.name);

    // Copy to .drevon/skills/ if not already there
    if (!existsSync(drevonDest)) {
      mkdirSync(drevonDest, { recursive: true });
      cpSync(agentsSrc, drevonDest, { recursive: true });
    }

    // Register in lock file if not already tracked
    if (!existing.some((s) => s.name === entry.name)) {
      let description = '';
      const skillMd = join(drevonDest, 'SKILL.md');
      if (existsSync(skillMd)) {
        const content = readFileSync(skillMd, 'utf-8');
        const match = content.match(/^description:\s*(.+)$/m);
        if (match) description = match[1].trim();
      }

      existing.push({
        name: entry.name,
        description,
        source: `.agents/skills/${entry.name}`,
        path: `.drevon/skills/${entry.name}`,
        hash: '',
        installedAt: new Date().toISOString(),
      });
      updated = true;
      migrated.push(entry.name);
    }
  }

  if (updated) {
    writeSkillsLock(dir, existing);
  }

  return migrated;
}
