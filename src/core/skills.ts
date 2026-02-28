export interface InstalledSkill {
  name: string;
  description: string;
  source: string;
  path: string;
  hash: string;
  installedAt: string;
}

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

export function readSkillsLock(dir: string): InstalledSkill[] {
  const lockPath = join(dir, 'skills-lock.json');
  if (!existsSync(lockPath)) return [];
  try {
    const data = JSON.parse(readFileSync(lockPath, 'utf-8'));
    return data.skills || [];
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
