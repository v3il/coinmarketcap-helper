import { fetchJson } from '@/utils/request';
import type { Rate } from '../common';
import { netOfFee } from './fee';
import type { NetworkModule } from './types';

// cosmos.directory (a free community service by ECO Stake) returns every Cosmos chain in one request (~2 MB),
// with the network's staking rate already calculated. `calculated_apr` is from inflation and the staked share;
// `estimated_apr` is less reliable.
const URL = 'https://chains.cosmos.directory/';
const SECONDS_PER_DAY = 86400;

const CHAINS: Record<string, { symbol: string; unbondingDays: number; note?: string }> = {
    celestia: { symbol: 'TIA', unbondingDays: 14 },
    fetchhub: { symbol: 'FET', unbondingDays: 21 },
    saga: {
        symbol: 'SAGA',
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

        return [[chain.symbol, {
            apr: netOfFee(gross), days: 0, unbondingDays, approximate: true, ...(chain.note ? { note: chain.note } : {})
        }]];
    });
}

export const cosmos: NetworkModule = {
    name: 'Cosmos',
    load: async () => parseCosmosChains(await fetchJson(URL))
};
