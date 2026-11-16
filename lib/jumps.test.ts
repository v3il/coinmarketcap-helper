import { describe, expect, it } from 'vitest';
import { findJumps, formatJumps, positionPercent } from './jumps';

const HOUR = 3600_000;
const baseline = (price: number, at = 0) => ({ price, at });

describe('findJumps', () => {
    it('finds a coin up by at least the threshold since the last check', () => {
        const jumps = findJumps(new Map([['xyz', 1.31]]), { xyz: baseline(1) }, 30);
        expect(jumps).toHaveLength(1);
        expect(jumps[0].symbol).toBe('xyz');
        expect(jumps[0].percent).toBeCloseTo(31);
    });

    it('ignores a smaller rise', () => {
        expect(findJumps(new Map([['xyz', 1.29]]), { xyz: baseline(1) }, 30)).toEqual([]);
    });

    it('needs a baseline: a coin seen for the first time only gets one', () => {
        expect(findJumps(new Map([['xyz', 5]]), {}, 30)).toEqual([]);
    });

    it('skips coins without a price this time', () => {
        expect(findJumps(new Map(), { xyz: baseline(1) }, 30)).toEqual([]);
    });
});

describe('positionPercent', () => {
    it('is the profit on what was put in, at the fresh price', () => {
        expect(positionPercent([{ balance: 10, cost: 5 }, { balance: 10, cost: 5 }], 1.4)).toBeCloseTo(180);
    });

    it('is unknown when any position has no cost', () => {
        expect(positionPercent([{ balance: 10, cost: 5 }, { balance: 10 }], 1)).toBeNull();
    });

    it('is unknown for coins that cost nothing (rewards, airdrops)', () => {
        expect(positionPercent([{ balance: 10, cost: 0 }], 1)).toBeNull();
    });
});

describe('formatJumps', () => {
    const jump = { symbol: 'xyz', percent: 31.4, since: 0, portfolios: ['Trash'], position: null };

    it('says how much and since when', () => {
        const text = formatJumps([jump], 6 * HOUR);
        expect(text).toContain('🚀');
        expect(text).toContain('XYZ');
        expect(text).toContain('+31%');
        expect(text).toContain('6 h ago');
    });

    it('counts days after a long pause', () => {
        expect(formatJumps([jump], 50 * HOUR)).toContain('2 days ago');
    });

    it('adds the position result when known', () => {
        expect(formatJumps([{ ...jump, position: 180 }], HOUR)).toContain('your position +180%');
        expect(formatJumps([{ ...jump, position: -40 }], HOUR)).toContain('your position −40%');
    });

    it('never shows amounts', () => {
        expect(formatJumps([{ ...jump, position: 180 }], HOUR)).not.toContain('$');
    });
});
