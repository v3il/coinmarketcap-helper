import { describe, expect, it } from 'vitest';
import { afterBuy, formatChange, formatCoins, formatPrice, parseUsd, positionStats } from './averaging';

describe('positionStats', () => {
    it('gives the average price and the drawdown', () => {
        expect(positionStats({ coins: 10, cost: 20 }, 1)).toEqual({ average: 2, change: -0.5 });
    });

    it('gives a positive change for a position in profit', () => {
        expect(positionStats({ coins: 10, cost: 5 }, 1)).toEqual({ average: 0.5, change: 1 });
    });

    it('has no average for a position that is paid back or empty', () => {
        const none = { average: null, change: null };
        expect(positionStats({ coins: 10, cost: 0 }, 1)).toEqual(none);
        expect(positionStats({ coins: 10, cost: -3 }, 1)).toEqual(none);
        expect(positionStats({ coins: 0, cost: 20 }, 1)).toEqual(none);
    });
});

describe('afterBuy', () => {
    it('adds the coins bought at the current price and their cost', () => {
        const after = afterBuy({ coins: 10, cost: 20 }, 1, 10);
        expect(after).toEqual({ coins: 20, cost: 30 });

        const stats = positionStats(after, 1);
        expect(stats.average).toBe(1.5);
        expect(stats.change).toBeCloseTo(-1 / 3);
    });
});

describe('parseUsd', () => {
    it('reads dollar amounts, comma as the thousands separator', () => {
        expect(parseUsd('100')).toBe(100);
        expect(parseUsd('12.5')).toBe(12.5);
        expect(parseUsd('1,000')).toBe(1000);
        expect(parseUsd(' $250 ')).toBe(250);
    });

    it('reads a lone comma as the decimal point', () => {
        expect(parseUsd('12,5')).toBe(12.5);
        expect(parseUsd('1,50')).toBe(1.5);
        expect(parseUsd('1,000.5')).toBe(1000.5);
    });

    it('rejects empty, zero, negative and malformed input', () => {
        ['', '0', '-5', 'abc', '1.2.3'].forEach((text) => expect(parseUsd(text)).toBeNull());
    });
});

describe('formatChange', () => {
    it('always shows the sign, one decimal', () => {
        expect(formatChange(-0.42)).toBe('−42.0%');
        expect(formatChange(0.1)).toBe('+10.0%');
        expect(formatChange(0)).toBe('0.0%');
    });
});

describe('formatPrice', () => {
    it('uses cents from $1 and four significant digits below', () => {
        expect(formatPrice(1234.5)).toBe('1,234.50');
        expect(formatPrice(0.012345)).toBe('0.01235');
    });
});

describe('formatCoins', () => {
    it('keeps two decimals from 1 coin, four significant digits below, no trailing zeros', () => {
        expect(formatCoins(1234.5678)).toBe('1,234.57');
        expect(formatCoins(2500000)).toBe('2,500,000');
        expect(formatCoins(20)).toBe('20');
        expect(formatCoins(12.5)).toBe('12.5');
        expect(formatCoins(0.012345)).toBe('0.01235');
    });
});
