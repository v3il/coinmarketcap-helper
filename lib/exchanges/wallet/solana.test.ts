import { describe, expect, it } from 'vitest';
import { solanaApr, solanaRate } from './solana';

describe('solanaApr', () => {
    it('spreads validator inflation over the staked share, after the fee', () => {
        expect(solanaApr(0.04, 600e9, 400e9)).toBe(5.4);
    });

    it('is 0 without stake', () => {
        expect(solanaApr(0.04, 600e9, 0)).toBe(0);
    });
});

describe('solanaRate', () => {
    it('is flexible with a ~3-day withdrawal and approximate', () => {
        expect(solanaRate(5.4)).toEqual({ apr: 5.4, days: 0, unbondingDays: 3, approximate: true });
    });
});
