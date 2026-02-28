export interface SkillPack {
  name: string;
  description: string;
  skills: string[];
}

export const SKILL_PACKS: SkillPack[] = [
  {
    name: 'essentials',
    description: 'Browser automation, PDF tools, skill creator',
    skills: ['browser-use/browser-use', 'nicobailon/pdf', 'skills-sh/skill-creator'],
  },
  {
    name: 'web-dev',
    description: 'Tailwind, UI/UX, SEO',
    skills: [
      'anthropics/tailwind-design-system',
      'anthropics/ui-ux-pro-max',
      'anthropics/web-design-guidelines',
      'anthropics/seo-audit',
    ],
  },
  {
    name: 'content',
    description: 'Copywriting, presentations, video',
    skills: ['anthropics/copywriting', 'nicobailon/pptx', 'JonnyBurger/remotion-best-practices'],
  },
  {
    name: 'ai-tools',
    description: 'Agent tools (inference.sh — 150+ AI models)',
    skills: ['anthropics/agent-tools'],
  },
];

export function getSkillPack(name: string): SkillPack | undefined {
  return SKILL_PACKS.find((p) => p.name === name);
}

export function listSkillPacks(): SkillPack[] {
  return SKILL_PACKS;
}
