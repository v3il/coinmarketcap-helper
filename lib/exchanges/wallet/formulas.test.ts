import { describe, expect, it } from 'vitest';
import { nibiApr } from './nibiru';
import { seiApr } from './sei';
import { suiApr } from './sui';

describe('seiApr', () => {
    it('shares the yearly fixed mint among bonded coins', () => {
        expect(seiApr(100, 2000)).toBe(4.5);
    });
});

describe('nibiApr', () => {
    it('counts only the share of each mint stakers get, minus the community tax', () => {
        // 10 per epoch × 360 epochs × 0.5 to stakers × (1 − 0.1 tax) / 1000 bonded = 162% gross
        expect(nibiApr({ perEpoch: 10, epochsPerYear: 360, stakersShare: 0.5, communityTax: 0.1 }, 1000)).toBe(145.8);
    });
});

describe('suiApr', () => {
    it('annualizes the rewards of the last epoch over the total stake', () => {
        expect(suiApr(1, 36500)).toBe(0.9);
    });
});

describe('zero stake', () => {
    it('gives 0 instead of Infinity', () => {
        expect(seiApr(1, 0)).toBe(0);
        expect(suiApr(1, 0)).toBe(0);
    });
});
