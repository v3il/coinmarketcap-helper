import { describe, expect, it } from 'vitest';
import { effectiveApr } from './common';

describe('effectiveApr', () => {
    it('blends tiers by the amount in each', () => {
        const rate = { apr: 8, days: 0, tiers: [{ from: 0, to: 100, apr: 8 }, { from: 100, to: Infinity, apr: 2 }] };
        expect(effectiveApr(rate, 200)).toBe(5);
    });

    it('is the headline APR without tiers', () => {
        expect(effectiveApr({ apr: 3, days: 0 }, 50)).toBe(3);
    });
});
