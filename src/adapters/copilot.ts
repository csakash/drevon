import { BaseAdapter } from './base.js';
import type { AgentId, DiagnosticResult } from '../types.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export class CopilotAdapter extends BaseAdapter {
  readonly agentId: AgentId = 'copilot';
  readonly agentName = 'GitHub Copilot';

  getOutputPaths(): string[] {
    return ['.github/copilot-instructions.md'];
  }

  compile(): Map<string, string> {
    const output = new Map<string, string>();
    let content = this.header();
    content += `# Copilot Instructions\n\n`;
    content += this.getMemoryProtocol() + '\n';
    content += `## Identity & Operating Mode\n\n`;
    content += `You are a **${this.config.identity.role}** — ${this.config.identity.description}\n\n`;
    content += `**Default operating posture:**\n${this.config.identity.posture}\n\n`;

    for (const instruction of this.getInstructions()) {
      content += `## ${instruction.title}\n\n${instruction.content}\n\n`;
    }

    const extra = this.getAgentExtra();
    if (extra) {
      content += `## Additional Copilot Instructions\n\n${extra}\n\n`;
    }

    content += this.getSkillsSection() + '\n';
    content += this.getWorkspaceSection() + '\n';
    content += this.getPromptsSection();

    output.set('.github/copilot-instructions.md', content.trimEnd() + '\n');
    return output;
  }

  diagnose(dir: string): DiagnosticResult[] {
    return [this.checkFile(dir, '.github/copilot-instructions.md')];
  }

  clean(dir: string): void {
    const path = join(dir, '.github', 'copilot-instructions.md');
    if (existsSync(path)) unlinkSync(path);
  }
}
