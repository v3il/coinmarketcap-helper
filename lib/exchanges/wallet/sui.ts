import { fetchJson } from '@/utils/request';
import { netOfFee } from './fee';
import type { NetworkModule } from './types';

// Sui pays rewards (stake subsidy + gas fees) every daily epoch. The old JSON-RPC is off; GraphQL gives the last
// finished epoch's rewards and the current total stake (inside the system state, ~300 KB).
const GRAPHQL = 'https://graphql.mainnet.sui.io/graphql';
const UNBONDING_DAYS = 1;

/** The last epoch's (a day's) rewards and the total stake (same unit) -> net yearly percent. */
export const suiApr = (epochRewards: number, totalStake: number) => (
    totalStake > 0 ? netOfFee((epochRewards * 365) / totalStake) : 0
);

const query = <T>(text: string) => fetchJson<{ data: T }>(GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: text })
}).then(({ data }) => data);

export const sui: NetworkModule = {
    name: 'Sui',
    async load() {
        type Current = { epoch: { epochId: number; systemState: { json: { validators: { total_stake: string } } } } };
        const { epoch } = await query<Current>(
            '{ epoch { epochId systemState { json } } }'
        );
        const previous = await query<{ epoch: { totalStakeRewards: string | null } }>(
            `{ epoch(epochId: ${epoch.epochId - 1}) { totalStakeRewards } }`
        );
        const apr = suiApr(
            Number(previous.epoch.totalStakeRewards ?? 0),
            Number(epoch.systemState.json.validators.total_stake)
        );

        return apr > 0 ? [['SUI', { apr, days: 0, unbondingDays: UNBONDING_DAYS, approximate: true }]] : [];
    }
};
