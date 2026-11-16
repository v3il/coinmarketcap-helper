import { describe, expect, it } from 'vitest';
import { findNewExchanges, withoutExchanges } from './newExchanges';
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
