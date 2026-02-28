import { BaseAdapter } from './base.js';
import type { AgentId, DiagnosticResult } from '../types.js';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export class ClaudeCodeAdapter extends BaseAdapter {
  readonly agentId: AgentId = 'claude';
  readonly agentName = 'Claude Code';

  getOutputPaths(): string[] {
    return ['CLAUDE.md'];
  }

  compile(): Map<string, string> {
    const output = new Map<string, string>();
    let content = this.header();
    content += `# CLAUDE.md\n\n`;
    content += `## Identity & Operating Mode\n\n`;
    content += `You are a **${this.config.identity.role}** — ${this.config.identity.description}\n\n`;
    content += `**Default operating posture:**\n${this.config.identity.posture}\n\n`;
    content += this.getMemoryProtocol() + '\n';

    for (const instruction of this.getInstructions()) {
      content += `## ${instruction.title}\n\n${instruction.content}\n\n`;
    }

    // Allowed commands
    const claudeConfig = this.config.agents.claude;
    if (claudeConfig?.allowedCommands?.length) {
      content += `## Allowed Commands\n\n`;
      content += 'The following commands are pre-approved:\n';
      for (const cmd of claudeConfig.allowedCommands) {
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

    output.set('CLAUDE.md', content.trimEnd() + '\n');
    return output;
  }

  diagnose(dir: string): DiagnosticResult[] {
    return [this.checkFile(dir, 'CLAUDE.md')];
  }

  clean(dir: string): void {
    const path = join(dir, 'CLAUDE.md');
    if (existsSync(path)) unlinkSync(path);
  }
}
