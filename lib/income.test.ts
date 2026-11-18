import { describe, expect, it } from 'vitest';
import type { Exchange } from './exchanges';
import { exchangeResolver } from './holdings';
import { formatIncomeStat, formatMovesTip, portfolioIncome } from './income';
import type { RatesByCoin } from './rates';

const exchange = (id: string): Exchange => ({ id, name: id, logoUrl: '', loadRates: async () => new Map() });
const bybit = exchange('bybit');
const binance = exchange('binance');

const rates: RatesByCoin = new Map([
    ['aaa', [{ exchange: bybit, rates: [{ apr: 2, days: 0 }] }, { exchange: binance, rates: [{ apr: 10, days: 0 }] }]],
    ['bbb', [{ exchange: bybit, rates: [{ apr: 5, days: 0 }] }]]
]);
const resolve = exchangeResolver({ Bybit: 'bybit', Savings: 'bybit' });
const holdings = {
    aaa: [{ portfolio: 'Bybit', value: 100, balance: 1 }],
    bbb: [{ portfolio: 'Bybit', value: 50, balance: 1 }, { portfolio: 'Savings', value: 50, balance: 1 }]
};

describe('portfolioIncome', () => {
    it('sums income now and at the best rates', () => {
        const income = portfolioIncome(holdings, rates, resolve, () => true);
        expect(income.value).toBe(200);
        expect(income.now).toBeCloseTo(2 + 5);
        expect(income.best).toBeCloseTo(10 + 5);
    });

    it('leaves out portfolios that are not included', () => {
        const income = portfolioIncome(holdings, rates, resolve, (name) => name !== 'Savings');
        expect(income.value).toBe(150);
        expect(income.now).toBeCloseTo(2 + 2.5);
    });

    it('lists moves worth making, biggest gain first', () => {
        const { moves } = portfolioIncome(holdings, rates, resolve, () => true);
        const summary = moves.map(({ symbol, place, best }) => [symbol, place, best.exchange.id]);
        expect(summary).toEqual([['AAA', 'Bybit', 'binance']]);
        expect(moves[0].gainUsd).toBeCloseTo(8);
    });
});

describe('formatIncomeStat', () => {
    it('shows USD and the share of the value', () => {
        expect(formatIncomeStat({ value: 200, now: 7, best: 15 }, false))
            .toEqual({ main: '$7.00 → $15.00 at best', percent: '3.50% → 7.50%' });
    });

    it('hides USD when CMC hides balances, keeps percentages', () => {
        const stat = formatIncomeStat({ value: 200, now: 7, best: 15 }, true);
        expect(stat.main).not.toContain('$');
        expect(stat.percent).toBe('3.50% → 7.50%');
    });

    it('shows 0% for an empty portfolio', () => {
        expect(formatIncomeStat({ value: 0, now: 0, best: 0 }, false).percent).toBe('0.00% → 0.00%');
    });
});

describe('formatMovesTip', () => {
    it('lists the top 3 moves in percentage points', () => {
        const move = (symbol: string, gain: number) => ({
            symbol,
            place: 'Bybit',
            nowApr: 1,
            best: { apr: 1 + gain, days: 0, exchange: binance },
            gainUsd: gain,
            gainCoins: null
        });
        const tip = formatMovesTip([move('AAA', 4.1), move('BBB', 3), move('CCC', 2), move('DDD', 1)]);
        expect(tip.split('\n')).toEqual([
            'Best moves:',
            'AAA: Bybit → binance, +4.1 pp',
            'BBB: Bybit → binance, +3.0 pp',
            'CCC: Bybit → binance, +2.0 pp'
        ]);
    });

    it('says so when every coin is already at its best rate', () => {
        expect(formatMovesTip([])).toBe('Every coin is already at its best rate');
    });
});
