import { describe, it, expect } from 'vitest';
import { scoreMemory, retentionTier, isProtected } from '../../src/core/retention.js';

describe('retention scoring', () => {
  it('scores fresh, high-salience memory as hot', () => {
    const score = scoreMemory('architecture', 0);
    expect(score).toBeGreaterThanOrEqual(0.7);
    expect(retentionTier(score)).toBe('hot');
  });

  it('decays with age', () => {
    const fresh = scoreMemory('pattern', 0);
    const old = scoreMemory('pattern', 300);
    expect(old).toBeLessThan(fresh);
  });

  it('ranks salience by type at equal age', () => {
    const age = 30;
    expect(scoreMemory('architecture', age)).toBeGreaterThan(scoreMemory('log', age));
    expect(scoreMemory('decision', age)).toBeGreaterThan(scoreMemory('workflow', age));
  });

  it('recent access reinforces the score', () => {
    const noAccess = scoreMemory('log', 100);
    const accessed = scoreMemory('log', 100, [1, 2]);
    expect(accessed).toBeGreaterThan(noAccess);
  });

  it('caps the score at 1', () => {
    expect(scoreMemory('architecture', 0, [1, 1, 1, 1, 1, 1, 1])).toBeLessThanOrEqual(1);
  });

  it('maps scores to tiers with the documented thresholds', () => {
    expect(retentionTier(0.9)).toBe('hot');
    expect(retentionTier(0.5)).toBe('warm');
    expect(retentionTier(0.2)).toBe('cold');
    expect(retentionTier(0.1)).toBe('evictable');
  });

  it('protects architecture and decisions from auto-eviction', () => {
    expect(isProtected('architecture')).toBe(true);
    expect(isProtected('decision')).toBe(true);
    expect(isProtected('log')).toBe(false);
  });
});
