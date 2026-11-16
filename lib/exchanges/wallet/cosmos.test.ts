import { describe, expect, it } from 'vitest';
import { parseCosmosChains } from './cosmos';

const chains = {
    chains: [
        { name: 'celestia', params: { calculated_apr: 0.06, unbonding_time: 1209600 } },
        { name: 'fetchhub', params: { calculated_apr: 0.08 } },
        { name: 'saga', params: { calculated_apr: 0.5, unbonding_time: 1814400 } },
        { name: 'osmosis', params: { calculated_apr: 0.1, unbonding_time: 1209600 } },
        { name: 'sei', params: { calculated_apr: null, unbonding_time: 1814400 } }
    ]
};

const bySymbol = () => new Map(parseCosmosChains(chains));

describe('parseCosmosChains', () => {
    it('says which network and wallets the rate is for', () => {
        expect(bySymbol().get('TIA')?.note).toBe('Native staking on Celestia: Keplr, Leap');
        expect(bySymbol().get('SAGA')?.note).toMatch(/^Native staking on Saga: Keplr, Leap\n/);
    });

    it('gives TIA its network rate after the validator fee', () => {
        expect(bySymbol().get('TIA')).toMatchObject({ apr: 5.4, days: 0, unbondingDays: 14, approximate: true });
    });

    it('falls back to a known unbonding period when the chain has none', () => {
        expect(bySymbol().get('FET')?.unbondingDays).toBe(21);
    });

    it('explains why SAGA is so high', () => {
        const saga = bySymbol().get('SAGA');
        expect(saga?.apr).toBe(45);
        expect(saga?.note).toMatch(/little of the supply is staked/);
    });

    it('ignores chains it does not cover and chains without a rate', () => {
        expect([...bySymbol().keys()].sort()).toEqual(['FET', 'SAGA', 'TIA']);
    });
});
