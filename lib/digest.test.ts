import { describe, expect, it } from 'vitest';
import { buildDigest } from './digest';
import type { Exchange } from './exchanges';
import type { RatesByCoin } from './rates';
import { DEFAULT_SETTINGS } from './storage';

const exchange = (id: string, name: string): Exchange => ({ id, name, logoUrl: '', loadRates: async () => new Map() });
const bybit = exchange('bybit', 'Bybit');
const binance = exchange('binance', 'Binance');
const mexc = exchange('mexc', 'MEXC');

const byCoin: RatesByCoin = new Map([
    ['aaa', [{ exchange: bybit, rates: [{ apr: 2, days: 0 }] }, { exchange: binance, rates: [{ apr: 10, days: 0 }] }]],
    ['bbb', [{ exchange: bybit, rates: [{ apr: 5, days: 0 }] }, { exchange: mexc, rates: [{ apr: 300, days: 3 }] }]],
    ['tiny', [{ exchange: mexc, rates: [{ apr: 400, days: 2 }] }]]
]);
const holdings = {
    aaa: [{ portfolio: 'Bybit', value: 100, balance: 1 }],
    bbb: [{ portfolio: 'Bybit', value: 50, balance: 2 }, { portfolio: 'Savings', value: 50, balance: 2 }],
    tiny: [{ portfolio: 'Bybit', value: 3, balance: 9 }]
};

describe('buildDigest', () => {
    it('sums up income, moves and promos (snapshot of the current output)', () => {
        const text = buildDigest({
            rates: { byCoin, failed: [] },
            holdings,
            settings: { ...DEFAULT_SETTINGS, excludedPortfolios: ['Savings'], portfolioExchanges: { Bybit: 'bybit' } }
        });
        expect(text).toMatchInlineSnapshot(`
          "📊 <b>Weekly summary</b>
          💰 Earning ~$4.50/yr (2.94% on average)
          🚀 Up to ~$13/yr (8.17%) with every coin at its best rate
          ✅ At the best rate already: 1 of 2 coins

          <b>Best moves</b>
          🪙 <b>AAA</b> · Bybit 2.00% → <b>Binance 10.00%</b> · flexible
             +$8.00/yr (+0.0800 AAA)

          <b>🎁 Promos running</b>
          🪙 BBB · MEXC · 3 days at 300.00%"
        `);
    });
});

describe('buildDigest with Wallet rates', () => {
    it('marks the approximate target rate with ≈', () => {
        const wallet = exchange('wallet', 'Wallet');
        const rates: RatesByCoin = new Map([
            ['tia', [{ exchange: bybit, rates: [{ apr: 1, days: 0 }] },
                { exchange: wallet, rates: [{ apr: 4.7, days: 0, approximate: true }] }]]
        ]);
        const text = buildDigest({
            rates: { byCoin: rates, failed: [] },
            holdings: { tia: [{ portfolio: 'Bybit', value: 100, balance: 10 }] },
            settings: { ...DEFAULT_SETTINGS, portfolioExchanges: { Bybit: 'bybit' } }
        });
        expect(text).toContain('<b>Wallet ≈4.70%</b>');
    });
});
