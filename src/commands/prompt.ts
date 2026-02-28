import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import pc from 'picocolors';
import * as logger from '../utils/logger.js';
import { colors } from '../utils/logger.js';

export async function promptCommand(action: string, arg?: string): Promise<void> {
  const cwd = process.cwd();
  const promptsDir = join(cwd, '.drevon', 'prompts');

  switch (action) {
    case 'list': {
      if (!existsSync(promptsDir)) {
        logger.info('No prompts directory. Run `drevon init` first.');
        return;
      }

      const files = readdirSync(promptsDir).filter(
        (f) => f.endsWith('.md') && f !== '_index.md',
      );

      if (files.length === 0) {
        logger.info('No prompts found. Create one with: drevon prompt create <name>');
        return;
      }

      console.log();
      console.log(pc.dim('  ┌ ') + colors.orangeBold('Available prompts'));
      console.log(pc.dim('  │'));
      for (const file of files) {
        const content = readFileSync(join(promptsDir, file), 'utf-8');
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const descMatch = content.match(/^description:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');
        const desc = descMatch ? descMatch[1].trim() : '';
        console.log(pc.dim('  │ ') + `${colors.orange('●')} ${colors.yellowBold(title)}${desc ? ` ${pc.dim('—')} ${pc.dim(desc)}` : ''}`);
      }
      console.log(pc.dim('  └'));
      console.log();
      break;
    }

    case 'create': {
      if (!arg) {
        logger.error('Usage: drevon prompt create <name>');
        process.exit(1);
      }

      if (!existsSync(promptsDir)) {
        mkdirSync(promptsDir, { recursive: true });
      }

      const fileName = arg.endsWith('.md') ? arg : `${arg}.md`;
      const filePath = join(promptsDir, fileName);

      if (existsSync(filePath)) {
        logger.warn(`Prompt already exists: ${fileName}`);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const title = arg.replace('.md', '').replace(/-/g, ' ');
      const content =
        `---\ntitle: ${title}\ndescription: \nauthor: user\ncreated: ${today}\ntags: []\n---\n\n# ${title}\n\n<!-- Add your workflow steps here -->\n`;

      writeFileSync(filePath, content);
      logger.success(`Created prompt: .drevon/prompts/${fileName}`);
      break;
    }

    default:
      logger.error(`Unknown prompt action: ${action}. Use list or create.`);
      process.exit(1);
  }
}
