import { fetchJson } from '@/utils/request';
import type { Rate } from '../common';
import { netOfFee, stakingRate } from './fee';
import type { NetworkModule } from './types';

// cosmos.directory (a free community service by ECO Stake) returns every Cosmos chain in one request (~2 MB),
// with the network's staking rate already calculated. `calculated_apr` is from inflation and the staked share;
// `estimated_apr` is less reliable.
const URL = 'https://chains.cosmos.directory/';
const SECONDS_PER_DAY = 86400;

const COSMOS_WALLETS = ['Keplr', 'Leap'];

const CHAINS: Record<string, { symbol: string; network: string; unbondingDays: number; note?: string }> = {
    celestia: { symbol: 'TIA', network: 'Celestia', unbondingDays: 14 },
    fetchhub: { symbol: 'FET', network: 'Fetch.ai', unbondingDays: 21 },
    saga: {
        symbol: 'SAGA',
        network: 'Saga',
        unbondingDays: 21,
        note: 'So high because little of the supply is staked: new coins are shared among few stakers'
    }
};

interface Chain {
    name: string;
    params?: { calculated_apr?: number | null; unbonding_time?: number | null };
}

export function parseCosmosChains(json: unknown): [string, Rate][] {
    const chains = (json as { chains?: Chain[] })?.chains ?? [];

    return chains.flatMap(({ name, params }): [string, Rate][] => {
        const chain = CHAINS[name];
        const gross = params?.calculated_apr;

        if (!chain || typeof gross !== 'number' || gross <= 0) {
            return [];
        }

        const unbondingDays = params?.unbonding_time
            ? Math.round(params.unbonding_time / SECONDS_PER_DAY)
            : chain.unbondingDays;

        return [[chain.symbol, stakingRate(netOfFee(gross), unbondingDays, {
            network: chain.network, wallets: COSMOS_WALLETS, note: chain.note
        })]];
    });
}

export const cosmos: NetworkModule = {
    name: 'Cosmos',
    load: async () => parseCosmosChains(await fetchJson(URL))
};
