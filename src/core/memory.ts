import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DrevonMode } from '../types.js';
import { loadMemoryTemplate } from '../utils/template.js';

const HUB_FILES = ['user.md', 'projects.md', 'systems.md', 'log.md'];
const PROJECT_FILES = ['context.md', 'decisions.md', 'patterns.md', 'log.md'];

export function initMemory(dir: string, mode: DrevonMode): string[] {
  const memoryDir = join(dir, '.drevon', 'memory');
  mkdirSync(memoryDir, { recursive: true });

  const files = mode === 'hub' ? HUB_FILES : PROJECT_FILES;
  const created: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const file of files) {
    const destPath = join(memoryDir, file);
    if (!existsSync(destPath)) {
      let content = loadMemoryTemplate(mode, file);
      content = content.replace(/YYYY-MM-DD/g, today);
      writeFileSync(destPath, content);
      created.push(`.drevon/memory/${file}`);
    }
  }

  return created;
}
