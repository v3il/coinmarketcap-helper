import { fetchJson } from '@/utils/request';
import { parseFraction, toRates, type Exchange } from './common';

// Ready (formerly Argent) wallet: native Starknet staking with Ready's validator. Same undocumented backend the
// wallet itself reads (found in the open-source Argent X extension); `totalApy` is after Ready's commission and
// is the number the app shows.
const URL = 'https://cloud.argent-api.com/v1/tokens/defi/investments?chain=starknet';
const LOGO = 'https://static.argent.net/dapp/logos/3131edcd-b7f4-47d4-89ae-bd461786e547.png';
const SECONDS_PER_DAY = 86400;

interface Investment {
    /** e.g. "Stake STRK (Native)" */
    name: string;
    category: string;
    stakerInfo?: { name?: string };
    metrics?: { totalApy?: string };
    withdrawableAssets?: { timelockDuration?: number };
}

interface Response {
    investments: Investment[];
}

const symbolOf = (investment: Investment) => investment.name.match(/^Stake (\S+) \(Native\)$/)?.[1] ?? null;

export const ready: Exchange = {
    id: 'ready',
    name: 'Ready',
    logoUrl: LOGO,

    async loadRates() {
        const { investments } = await fetchJson<Response>(URL);

        return toRates(investments, (investment) => {
            const symbol = symbolOf(investment);

            if (investment.category !== 'strkDelegatedStaking' || investment.stakerInfo?.name !== 'Ready' || !symbol) {
                return [];
            }

            // Staking can be exited any time, but withdrawing takes the unbonding period (7 days).
            const days = Math.round((investment.withdrawableAssets?.timelockDuration ?? 0) / SECONDS_PER_DAY);

            return [[symbol, { apr: parseFraction(investment.metrics?.totalApy ?? ''), days }]];
        });
    }
};
