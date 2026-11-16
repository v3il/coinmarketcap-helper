import { fetchJson } from '@/utils/request';
import { netOfFee } from './fee';
import type { NetworkModule } from './types';

// Aptos pays staking rewards every 2-hour epoch at a rate stored on chain as a 64-bit fixed-point fraction.
// StakingRewardsConfig is the current one (StakingConfig.rewards_rate is deprecated). Anonymous requests are
// rate-limited per IP, which a check every few hours stays well under.
const URL = 'https://api.mainnet.aptoslabs.com/v1/accounts/0x1/resource/0x1::staking_config::StakingRewardsConfig';
const EPOCHS_PER_YEAR = 4380;
const UNBONDING_DAYS = 14;

/** Per-epoch rewards rate (fixed point, value / 2^64) -> net yearly percent. */
export function aptosApr(rewardsRateValue: string): number {
    const perEpoch = Number(rewardsRateValue) / 2 ** 64;
    return Number.isFinite(perEpoch) && perEpoch > 0 ? netOfFee(perEpoch * EPOCHS_PER_YEAR) : 0;
}

export const aptos: NetworkModule = {
    name: 'Aptos',
    async load() {
        const { data } = await fetchJson<{ data: { rewards_rate: { value: string } } }>(URL);
        const apr = aptosApr(data.rewards_rate.value);

        return apr > 0 ? [['APT', { apr, days: 0, unbondingDays: UNBONDING_DAYS, approximate: true }]] : [];
    }
};
