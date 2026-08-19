import { BaseAdapter } from './base.js';
import type { AgentId, DiagnosticResult } from '../types.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Google Antigravity CLI (`agy`).
 *
 * Follows the AGENTS.md convention (verified against agy 1.1.15: its rules
 * and agents system reads workspace markdown; there is no GEMINI.md-style
 * file of its own). Sharing AGENTS.md with codex is intentional — it is the
 * cross-vendor convention both CLIs read.
 */
export class AntigravityAdapter extends BaseAdapter {
  readonly agentId: AgentId = 'antigravity';
  readonly agentName = 'Antigravity CLI';

  getOutputPaths(): string[] {
    return ['AGENTS.md'];
  }

  compile(): Map<string, string> {
    const output = new Map<string, string>();
    let content = this.header();
    content += `# AGENTS.md\n\n`;
    content += `## Identity & Operating Mode\n\n`;
    content += `You are a **${this.config.identity.role}** — ${this.config.identity.description}\n\n`;
    content += `**Default operating posture:**\n${this.config.identity.posture}\n\n`;
    content += this.getMemoryProtocol() + '\n';

    for (const instruction of this.getInstructions()) {
      content += `## ${instruction.title}\n\n${instruction.content}\n\n`;
    }

    const extra = this.getAgentExtra();
    if (extra) {
      content += `## Additional Instructions\n\n${extra}\n\n`;
    }

    content += this.getSkillsSection() + '\n';
    content += this.getWorkspaceSection() + '\n';
    content += this.getPromptsSection();

    output.set('AGENTS.md', content.trimEnd() + '\n');
    return output;
  }

  diagnose(dir: string): DiagnosticResult[] {
    return [this.checkFile(dir, 'AGENTS.md')];
  }

  clean(dir: string): void {
    const path = join(dir, 'AGENTS.md');
    if (existsSync(path)) unlinkSync(path);
  }
}
