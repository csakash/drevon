import { BaseAdapter } from './base.js';
import type { AgentId, DiagnosticResult } from '../types.js';
import { unlinkSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export class CursorAdapter extends BaseAdapter {
  readonly agentId: AgentId = 'cursor';
  readonly agentName = 'Cursor';

  getOutputPaths(): string[] {
    const paths = ['.cursor/rules/core.mdc', '.cursor/rules/memory.mdc'];
    // Add per-instruction files for glob-targeted instructions
    for (const instr of this.getInstructions()) {
      if (instr.globs?.length && !instr.alwaysApply) {
        paths.push(`.cursor/rules/${instr.id}.mdc`);
      }
    }
    return paths;
  }

  compile(): Map<string, string> {
    const output = new Map<string, string>();

    // Core rule: identity + always-apply instructions
    let core = '';
    core += '---\n';
    core += 'description: "Core workspace identity and operating rules"\n';
    core += 'alwaysApply: true\n';
    core += '---\n';
    core += this.header();
    core += `\n# Identity\n\n`;
    core += `You are a **${this.config.identity.role}** — ${this.config.identity.description}\n`;
    core += `${this.config.identity.posture}\n`;

    for (const instruction of this.getInstructions()) {
      if (instruction.alwaysApply && instruction.id !== 'memory-protocol') {
        core += `\n## ${instruction.title}\n\n${instruction.content}\n`;
      }
    }

    const extra = this.getAgentExtra();
    if (extra) {
      core += `\n## Additional Instructions\n\n${extra}\n`;
    }

    if (this.config.workspace.enabled) {
      core += `\n${this.getWorkspaceSection()}`;
    }

    core += `\n${this.getPromptsSection()}`;
    output.set('.cursor/rules/core.mdc', core.trimEnd() + '\n');

    // Memory rule
    if (this.config.memory.enabled) {
      let memory = '';
      memory += '---\n';
      memory += 'description: "Memory Protocol — persistent memory across sessions"\n';
      memory += 'alwaysApply: true\n';
      memory += '---\n';
      memory += this.header();
      memory += '\n' + this.getMemoryProtocol();
      output.set('.cursor/rules/memory.mdc', memory.trimEnd() + '\n');
    }

    // Per-instruction rules (glob-targeted)
    for (const instruction of this.getInstructions()) {
      if (instruction.globs?.length && !instruction.alwaysApply) {
        let rule = '';
        rule += '---\n';
        rule += `description: "${instruction.title}"\n`;
        rule += `globs: ${JSON.stringify(instruction.globs)}\n`;
        rule += 'alwaysApply: false\n';
        rule += '---\n';
        rule += `\n${instruction.content}\n`;
        output.set(`.cursor/rules/${instruction.id}.mdc`, rule.trimEnd() + '\n');
      }
    }

    // Skills rule
    if (this.config.skills.enabled) {
      let skills = '';
      skills += '---\n';
      skills += 'description: "Installed skills from skills.sh"\n';
      skills += 'alwaysApply: true\n';
      skills += '---\n';
      skills += '\n' + this.getSkillsSection();
      output.set('.cursor/rules/skills.mdc', skills.trimEnd() + '\n');
    }

    return output;
  }

  diagnose(dir: string): DiagnosticResult[] {
    return this.getOutputPaths().map((p) => this.checkFile(dir, p));
  }

  clean(dir: string): void {
    const rulesDir = join(dir, '.cursor', 'rules');
    if (!existsSync(rulesDir)) return;
    const files = readdirSync(rulesDir);
    for (const file of files) {
      unlinkSync(join(rulesDir, file));
    }
  }
}
