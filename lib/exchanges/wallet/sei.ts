import { fetchJson } from '@/utils/request';
import { netOfFee, stakingRate } from './fee';
import type { NetworkModule } from './types';

// SEI has no inflation: it mints a fixed amount per yearly period (all of it to stakers, no community tax).
const REST = 'https://rest.cosmos.directory/sei';
const UNBONDING_DAYS = 21;

/** The current period's mint and the bonded amount (same unit) -> net yearly percent. */
export const seiApr = (mintPerYear: number, bonded: number) => (bonded > 0 ? netOfFee(mintPerYear / bonded) : 0);

export const sei: NetworkModule = {
    name: 'Sei',
    async load() {
        const [minter, { pool }] = await Promise.all([
            fetchJson<{ total_mint_amount: string; start_date: string; end_date: string }>(
                `${REST}/seichain/mint/v1beta1/minter`
            ),
            fetchJson<{ pool: { bonded_tokens: string } }>(`${REST}/cosmos/staking/v1beta1/pool`)
        ]);
        // The period is a year (start..end dates); scale in case a release uses another length.
        const days = (Date.parse(minter.end_date) - Date.parse(minter.start_date)) / 86400000 + 1;
        const perYear = (Number(minter.total_mint_amount) * 365) / (days > 0 ? days : 365);
        const apr = seiApr(perYear, Number(pool.bonded_tokens));

        const where = { network: 'Sei', wallets: ['Keplr', 'Compass'] };
        return apr > 0 ? [['SEI', stakingRate(apr, UNBONDING_DAYS, where)]] : [];
    }
};
