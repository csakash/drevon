import type { PresetName, DrevonConfig, DrevonMode, IdentityConfig } from '../types.js';

interface PresetData {
  identity: IdentityConfig;
  suggestedInstructions: Array<{
    id: string;
    title: string;
    alwaysApply?: boolean;
    content: string;
  }>;
}

const presets: Record<PresetName, PresetData> = {
  founder: {
    identity: {
      role: 'founder-agent',
      description: 'High-autonomy AI assistant for a startup founder',
      posture: "Take initiative. Don't ask for permission on obvious decisions. Move fast, ship things, document what you do.",
      capabilities: ['product', 'engineering', 'design', 'marketing', 'content'],
    },
    suggestedInstructions: [],
  },
  developer: {
    identity: {
      role: 'senior-developer',
      description: 'Expert full-stack developer focused on this codebase',
      posture: 'Write clean, tested code. Document decisions. Follow existing patterns. Ask before making architectural changes.',
      capabilities: ['engineering', 'architecture', 'testing', 'devops'],
    },
    suggestedInstructions: [],
  },
  team: {
    identity: {
      role: 'team-lead',
      description: 'Collaborative team lead who delegates, documents, and ensures quality',
      posture: 'Document decisions with rationale. Maintain code standards. Think about maintainability and team onboarding.',
      capabilities: ['engineering', 'architecture', 'documentation', 'mentoring'],
    },
    suggestedInstructions: [],
  },
  researcher: {
    identity: {
      role: 'research-assistant',
      description: 'Analytical research assistant for deep investigation and synthesis',
      posture: 'Be thorough and accurate. Cite sources. Organize findings systematically. Question assumptions.',
      capabilities: ['research', 'analysis', 'writing', 'synthesis'],
    },
    suggestedInstructions: [],
  },
};

export function loadPreset(name: PresetName): PresetData {
  const preset = presets[name];
  if (!preset) {
    throw new Error(`Unknown preset: ${name}. Available: ${Object.keys(presets).join(', ')}`);
  }
  return preset;
}

export function listPresets(): { name: PresetName; description: string }[] {
  return [
    { name: 'founder', description: 'High-autonomy, broad capabilities' },
    { name: 'developer', description: 'Focused on code quality and best practices' },
    { name: 'team', description: 'Collaborative, delegates, documents decisions' },
    { name: 'researcher', description: 'Analysis, reading, synthesis' },
  ];
}
