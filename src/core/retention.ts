// ── Retention scoring ─────────────────────────────────────────────
// Ebbinghaus-style forgetting curve, adapted for the file-based store:
//   score = min(1, salience · e^(−λ·ageDays) + σ · Σ 1/daysSinceAccess)
// Salience is type-weighted; recent access reinforces retention.

export type MemoryType = 'architecture' | 'decision' | 'pattern' | 'bug' | 'workflow' | 'log';

export type RetentionTier = 'hot' | 'warm' | 'cold' | 'evictable';

const SALIENCE: Record<MemoryType, number> = {
  architecture: 0.9,
  decision: 0.85,
  pattern: 0.8,
  bug: 0.7,
  workflow: 0.6,
  log: 0.5,
};

export const LAMBDA = 0.01; // decay per day
export const SIGMA = 0.3; // access reinforcement weight

/**
 * Retention score in [0, 1]. Higher = keep resident/hotter.
 * @param ageDays days since the memory was written
 * @param accessDaysAgo list of "days ago" for each recorded access (optional)
 */
export function scoreMemory(type: MemoryType, ageDays: number, accessDaysAgo: number[] = []): number {
  const salience = SALIENCE[type] ?? 0.5;
  const decay = salience * Math.exp(-LAMBDA * Math.max(0, ageDays));
  const access = SIGMA * accessDaysAgo.reduce((sum, d) => sum + 1 / Math.max(1, d), 0);
  return Math.min(1, decay + access);
}

export function retentionTier(score: number): RetentionTier {
  if (score >= 0.7) return 'hot';
  if (score >= 0.4) return 'warm';
  if (score >= 0.15) return 'cold';
  return 'evictable';
}

/** Types that mechanical compaction must never auto-evict — only summarize in place. */
export const PROTECTED_TYPES: readonly MemoryType[] = ['architecture', 'decision'];

export function isProtected(type: MemoryType): boolean {
  return PROTECTED_TYPES.includes(type);
}
