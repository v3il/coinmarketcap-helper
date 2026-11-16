import { describe, expect, it } from 'vitest';
import { findNewExchanges, keepMissing, withoutExchanges } from './newExchanges';
import type { BestRate, CoinSnapshot } from './storage';

const rate = (exchangeId: string, apr = 5): BestRate => ({ apr, days: 0, exchangeId, exchangeName: exchangeId });
const snap = (...ids: string[]): CoinSnapshot => Object.fromEntries(ids.map((id) => [id, rate(id)]));

describe('findNewExchanges', () => {
    it('finds an exchange that no previous baseline had', () => {
        expect(findNewExchanges({ tia: snap('bybit') }, { tia: snap('bybit', 'wallet') })).toEqual(new Set(['wallet']));
    });

    it('is empty once any coin already has a baseline from it', () => {
        const previous = { tia: snap('bybit'), sol: snap('wallet') };
        expect(findNewExchanges(previous, { tia: snap('bybit', 'wallet') })).toEqual(new Set());
    });

    it('is empty on a fresh install (no baselines at all)', () => {
        expect(findNewExchanges({}, { tia: snap('bybit', 'wallet') })).toEqual(new Set());
    });
});

describe('withoutExchanges', () => {
    it('drops only the listed exchanges', () => {
        expect(Object.keys(withoutExchanges(snap('bybit', 'wallet'), new Set(['wallet'])))).toEqual(['bybit']);
    });
});

describe('keepMissing', () => {
    it('keeps the last rate of a coin from an exchange that answered only in part (one network down)', () => {
        const kept = keepMissing({ tia: snap('bybit') }.tia, { tia: snap('bybit', 'wallet') }.tia, new Set(['wallet']));
        expect(Object.keys(kept).sort()).toEqual(['bybit', 'wallet']);
    });

    it('leaves other exchanges and fresh rates alone', () => {
        const fresh = { wallet: rate('wallet', 9) };
        expect(keepMissing(fresh, { wallet: rate('wallet', 5), okx: rate('okx') }, new Set(['wallet'])))
            .toEqual(fresh);
    });
});
