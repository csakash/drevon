import * as clack from '@clack/prompts';
import type { DrevonMode, AgentId, IdentityConfig, PresetName } from '../types.js';
import { getAllAgentIds, getAgentDisplayName } from '../adapters/registry.js';

export async function promptMode(
  suggested: DrevonMode,
  reason: string,
): Promise<DrevonMode> {
  const confirm = await clack.confirm({
    message: `${reason}. Initialize as ${suggested} mode?`,
    initialValue: true,
  });

  if (clack.isCancel(confirm)) {
    clack.cancel('Operation cancelled.');
    process.exit(0);
  }

  if (confirm) return suggested;
  return suggested === 'hub' ? 'project' : 'hub';
}

export async function promptName(detected?: string): Promise<string> {
  const name = await clack.text({
    message: detected
      ? `Project name: (detected: ${detected})`
      : "What's your workspace name?",
    defaultValue: detected || 'my-workspace',
    placeholder: detected || 'my-workspace',
  });

  if (clack.isCancel(name)) {
    clack.cancel('Operation cancelled.');
    process.exit(0);
  }

  return name as string;
}

export async function promptIdentity(): Promise<PresetName> {
  const preset = await clack.select({
    message: 'Choose your identity template:',
    options: [
      { value: 'founder' as const, label: 'Founder Agent — high-autonomy, broad capabilities' },
      { value: 'developer' as const, label: 'Developer — focused on code quality and best practices' },
      { value: 'team' as const, label: 'Team Lead — collaborative, delegates, documents decisions' },
      { value: 'researcher' as const, label: 'Researcher — analysis, reading, synthesis' },
    ],
  });

  if (clack.isCancel(preset)) {
    clack.cancel('Operation cancelled.');
    process.exit(0);
  }

  return preset as PresetName;
}

export async function promptAgents(): Promise<AgentId[]> {
  const allAgents = getAllAgentIds();
  const selected = await clack.multiselect({
    message: 'Which agents do you use? (select all that apply)',
    options: allAgents.map((id) => ({
      value: id,
      label: getAgentDisplayName(id),
    })),
    initialValues: [] as AgentId[],
    required: true,
  });

  if (clack.isCancel(selected)) {
    clack.cancel('Operation cancelled.');
    process.exit(0);
  }

  return selected as AgentId[];
}

export async function promptMemory(): Promise<boolean> {
  const result = await clack.confirm({
    message: 'Enable persistent memory system?',
    initialValue: true,
  });

  if (clack.isCancel(result)) {
    clack.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as boolean;
}

export async function promptStarterPrompts(): Promise<boolean> {
  const result = await clack.confirm({
    message: 'Install starter prompts? (code-review, debug, new-feature, refactor, write-tests)',
    initialValue: true,
  });

  if (clack.isCancel(result)) {
    clack.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as boolean;
}

export function getPresetIdentity(preset: PresetName): IdentityConfig {
  const presets: Record<PresetName, IdentityConfig> = {
    founder: {
      role: 'founder-agent',
      description: 'High-autonomy AI assistant for a startup founder',
      posture: "Take initiative. Don't ask for permission on obvious decisions. Move fast, ship things, document what you do.",
      capabilities: ['product', 'engineering', 'design', 'marketing', 'content'],
    },
    developer: {
      role: 'senior-developer',
      description: 'Expert full-stack developer focused on this codebase',
      posture: 'Write clean, tested code. Document decisions. Follow existing patterns. Ask before making architectural changes.',
      capabilities: ['engineering', 'architecture', 'testing', 'devops'],
    },
    team: {
      role: 'team-lead',
      description: 'Collaborative team lead who delegates, documents, and ensures quality',
      posture: 'Document decisions with rationale. Maintain code standards. Think about maintainability and team onboarding.',
      capabilities: ['engineering', 'architecture', 'documentation', 'mentoring'],
    },
    researcher: {
      role: 'research-assistant',
      description: 'Analytical research assistant for deep investigation and synthesis',
      posture: 'Be thorough and accurate. Cite sources. Organize findings systematically. Question assumptions.',
      capabilities: ['research', 'analysis', 'writing', 'synthesis'],
    },
  };

  return presets[preset];
}
