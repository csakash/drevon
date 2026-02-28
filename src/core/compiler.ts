import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { DrevonConfig, AgentId, CompileResult } from '../types.js';
import { getAdapter } from '../adapters/registry.js';

export function compile(dir: string, config: DrevonConfig): CompileResult {
  const result: CompileResult = { created: [], updated: [], unchanged: [] };

  const enabledAgents = Object.entries(config.agents)
    .filter(([, cfg]) => cfg?.enabled)
    .map(([id]) => id as AgentId);

  for (const agentId of enabledAgents) {
    const adapter = getAdapter(agentId, config);
    const files = adapter.compile();

    for (const [relativePath, content] of files) {
      const fullPath = join(dir, relativePath);
      const parentDir = dirname(fullPath);

      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }

      if (existsSync(fullPath)) {
        const existing = readFileSync(fullPath, 'utf-8');
        if (existing === content) {
          result.unchanged.push(relativePath);
        } else {
          writeFileSync(fullPath, content);
          result.updated.push(relativePath);
        }
      } else {
        writeFileSync(fullPath, content);
        result.created.push(relativePath);
      }
    }
  }

  return result;
}
