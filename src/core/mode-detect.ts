import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { DrevonMode } from '../types.js';
import { isGitRepo, hasPackageJson, hasSrcDir } from '../utils/git.js';

export interface ModeDetectionResult {
  suggested: DrevonMode;
  reason: string;
}

export function detectMode(dir: string): ModeDetectionResult {
  if (isGitRepo(dir) || hasPackageJson(dir) || hasSrcDir(dir)) {
    return { suggested: 'project', reason: 'Detected existing codebase' };
  }

  if (existsSync(join(dir, 'workspace'))) {
    return { suggested: 'hub', reason: 'Detected existing workspace' };
  }

  // Check if directory is empty or nearly empty
  const entries = readdirSync(dir).filter(
    (e) => !e.startsWith('.') && e !== 'TECHNICAL_PLAN.md' && e !== 'IMPLEMENTATION_PLAN.md',
  );
  if (entries.length === 0 || (entries.length === 1 && entries[0] === 'README.md')) {
    return { suggested: 'hub', reason: 'Empty directory — starting fresh' };
  }

  return { suggested: 'hub', reason: 'No codebase detected' };
}
