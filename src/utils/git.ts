import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

export function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, '.git'));
}

export function hasPackageJson(dir: string): boolean {
  return existsSync(join(dir, 'package.json'));
}

export function hasSrcDir(dir: string): boolean {
  return existsSync(join(dir, 'src'));
}

export function getProjectName(dir: string): string {
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    } catch {
      // fall through
    }
  }
  return basename(dir);
}

export function appendGitignore(dir: string, lines: string[]): void {
  const gitignorePath = join(dir, '.gitignore');
  let existing = '';
  if (existsSync(gitignorePath)) {
    existing = readFileSync(gitignorePath, 'utf-8');
  }

  const newLines = lines.filter((line) => !existing.includes(line));
  if (newLines.length === 0) return;

  const block = `\n# AI Native Workspace (drevon)\n${newLines.join('\n')}\n`;

  if (existsSync(gitignorePath)) {
    appendFileSync(gitignorePath, block);
  } else {
    writeFileSync(gitignorePath, block.trimStart());
  }
}
