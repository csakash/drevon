import { BaseAdapter } from './base.js';
import type { AgentId, DiagnosticResult } from '../types.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export class GeminiAdapter extends BaseAdapter {
  readonly agentId: AgentId = 'gemini';
  readonly agentName = 'Gemini CLI';

  getOutputPaths(): string[] {
    return ['GEMINI.md'];
  }

  compile(): Map<string, string> {
    const output = new Map<string, string>();
    let content = this.header();
    content += `# GEMINI.md\n\n`;
    content += `## Identity & Operating Mode\n\n`;
    content += `You are a **${this.config.identity.role}** — ${this.config.identity.description}\n\n`;
    content += `**Default operating posture:**\n${this.config.identity.posture}\n\n`;
    content += this.getMemoryProtocol() + '\n';

    for (const instruction of this.getInstructions()) {
      content += `## ${instruction.title}\n\n${instruction.content}\n\n`;
    }

    // Allowed commands
    const geminiConfig = this.config.agents.gemini;
    if (geminiConfig?.allowedCommands?.length) {
      content += `## Allowed Commands\n\n`;
      content += 'The following commands are pre-approved:\n';
      for (const cmd of geminiConfig.allowedCommands) {
        content += `- \`${cmd}\`\n`;
      }
      content += '\n';
    }

    const extra = this.getAgentExtra();
    if (extra) {
      content += `## Additional Instructions\n\n${extra}\n\n`;
    }

    content += this.getSkillsSection() + '\n';
    content += this.getWorkspaceSection() + '\n';
    content += this.getPromptsSection();

    output.set('GEMINI.md', content.trimEnd() + '\n');
    return output;
  }

  diagnose(dir: string): DiagnosticResult[] {
    return [this.checkFile(dir, 'GEMINI.md')];
  }

  clean(dir: string): void {
    const path = join(dir, 'GEMINI.md');
    if (existsSync(path)) unlinkSync(path);
  }
}
