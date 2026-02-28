import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadPromptTemplate } from '../utils/template.js';

const STARTER_PROMPTS = [
  'code-review.md',
  'debug.md',
  'new-feature.md',
  'refactor.md',
  'write-tests.md',
];

export async function initPrompts(
  dir: string,
  includeStarters: boolean,
): Promise<string[]> {
  const promptsDir = join(dir, '.drevon', 'prompts');
  mkdirSync(promptsDir, { recursive: true });

  const created: string[] = [];

  // Generate _index.md
  const indexPath = join(promptsDir, '_index.md');
  if (!existsSync(indexPath)) {
    writeFileSync(
      indexPath,
      '# Prompts Directory\n\n' +
        'Reusable workflow templates. Create new prompts or let your agent create them.\n\n' +
        '| Prompt | Description |\n' +
        '|--------|-------------|\n',
    );
    created.push('.drevon/prompts/_index.md');
  }

  if (includeStarters) {
    for (const file of STARTER_PROMPTS) {
      const destPath = join(promptsDir, file);
      if (!existsSync(destPath)) {
        const content = loadPromptTemplate(file);
        writeFileSync(destPath, content);
        created.push(`.drevon/prompts/${file}`);
      }
    }
    // Regenerate index with starters
    generatePromptsIndex(dir);
  }

  return created;
}

export function generatePromptsIndex(dir: string): void {
  const promptsDir = join(dir, '.drevon', 'prompts');
  if (!existsSync(promptsDir)) return;

  const files = readdirSync(promptsDir).filter(
    (f) => f.endsWith('.md') && f !== '_index.md',
  );

  let content = '# Prompts Directory\n\n';
  content += 'Reusable workflow templates. Create new prompts or let your agent create them.\n\n';
  content += '| Prompt | Description |\n';
  content += '|--------|-------------|\n';

  for (const file of files) {
    const raw = readFileSync(join(promptsDir, file), 'utf-8');
    const titleMatch = raw.match(/^title:\s*(.+)$/m);
    const descMatch = raw.match(/^description:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');
    const desc = descMatch ? descMatch[1].trim() : '';
    content += `| [${title}](./${file}) | ${desc} |\n`;
  }

  writeFileSync(join(promptsDir, '_index.md'), content);
}
