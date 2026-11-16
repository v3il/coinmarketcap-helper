import { fetchJson } from '@/utils/request';
import { netOfFee } from './fee';
import type { NetworkModule } from './types';

// Nibiru mints a provision every epoch (a day) and gives stakers only part of it (28.125% now), so
// "inflation ÷ staked" would overstate the rate about threefold. All factors are read from the chain.
const REST = 'https://rest.cosmos.directory/nibiru';
const UNBONDING_DAYS = 21;

export interface NibiruMint {
    perEpoch: number;
    epochsPerYear: number;
    stakersShare: number;
    communityTax: number;
}

export function nibiApr({ perEpoch, epochsPerYear, stakersShare, communityTax }: NibiruMint, bonded: number) {
    return bonded > 0 ? netOfFee((perEpoch * epochsPerYear * stakersShare * (1 - communityTax)) / bonded) : 0;
}

interface InflationParams {
    params: {
        epochs_per_period: string;
        periods_per_year: string;
        inflation_distribution: { staking_rewards: string };
    };
}

export const nibiru: NetworkModule = {
    name: 'Nibiru',
    async load() {
        const [provision, inflation, distribution, { pool }] = await Promise.all([
            fetchJson<{ epoch_mint_provision: { amount: string } }>(`${REST}/nibiru/inflation/v1/epoch_mint_provision`),
            fetchJson<InflationParams>(`${REST}/nibiru/inflation/v1/params`),
            fetchJson<{ params: { community_tax: string } }>(`${REST}/cosmos/distribution/v1beta1/params`),
            fetchJson<{ pool: { bonded_tokens: string } }>(`${REST}/cosmos/staking/v1beta1/pool`)
        ]);
        const { params } = inflation;
        const apr = nibiApr({
            perEpoch: Number(provision.epoch_mint_provision.amount),
            epochsPerYear: Number(params.epochs_per_period) * Number(params.periods_per_year),
            stakersShare: Number(params.inflation_distribution.staking_rewards),
            communityTax: Number(distribution.params.community_tax)
        }, Number(pool.bonded_tokens));

        return apr > 0 ? [['NIBI', { apr, days: 0, unbondingDays: UNBONDING_DAYS, approximate: true }]] : [];
    }
};
