import { describe, it, expect } from 'vitest';
import { computeSharpe } from '@/lib/utils/stats';

describe('computeSharpe', () => {
  it('returns null for empty array', () => {
    expect(computeSharpe([])).toBeNull();
  });
  it('returns null for a single data point', () => {
    expect(computeSharpe([100])).toBeNull();
  });
  it('returns null when all values identical (zero stdev)', () => {
    expect(computeSharpe([100, 100, 100, 100])).toBeNull();
  });
  it('matches expected value for a known cents series', () => {
    // dailyCents = [100, -100, 200, 0]
    // mean = 50, sample stdev ≈ 129.0994, annualized by sqrt(252)
    // expected ≈ 50 / 129.0994 * sqrt(252) ≈ 6.1478
    const result = computeSharpe([100, -100, 200, 0]);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(6.1478, 3);
  });
  it('is negative for net-losing series', () => {
    const s = computeSharpe([-100, -200, -150, -50]);
    expect(s).not.toBeNull();
    expect(s!).toBeLessThan(0);
  });
});
