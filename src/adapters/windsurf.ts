import { BaseAdapter } from './base.js';
import type { AgentId, DiagnosticResult } from '../types.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export class WindsurfAdapter extends BaseAdapter {
  readonly agentId: AgentId = 'windsurf';
  readonly agentName = 'Windsurf';

  getOutputPaths(): string[] {
    return ['.windsurfrules'];
  }

  compile(): Map<string, string> {
    const output = new Map<string, string>();
    let content = this.header();
    content += `# Windsurf Rules\n\n`;
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

    output.set('.windsurfrules', content.trimEnd() + '\n');
    return output;
  }

  diagnose(dir: string): DiagnosticResult[] {
    return [this.checkFile(dir, '.windsurfrules')];
  }

  clean(dir: string): void {
    const path = join(dir, '.windsurfrules');
    if (existsSync(path)) unlinkSync(path);
  }
}
