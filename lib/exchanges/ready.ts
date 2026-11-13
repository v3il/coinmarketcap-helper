import { fetchJson } from '@/utils/request';
import { parseFraction, toRates, type Exchange } from './common';

// Ready (formerly Argent) wallet: native Starknet staking with Ready's validator. Same undocumented backend the
// wallet itself reads (found in the open-source Argent X extension); `totalApy` is after Ready's commission and
// is the number the app shows.
const URL = 'https://cloud.argent-api.com/v1/tokens/defi/investments?chain=starknet';
const LOGO = 'https://static.argent.net/dapp/logos/3131edcd-b7f4-47d4-89ae-bd461786e547.png';
const SECONDS_PER_DAY = 86400;

/**
 * Starknet token address -> symbol. Product names are localized by the browser's language ("Stake STRK (Native)",
 * "Стейкінг STRK (Нативний)" …), so coins are identified by token address instead.
 */
const TOKENS: Record<string, string> = {
    '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': 'STRK',
    '0x3fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac': 'WBTC',
    '0x4daa17763b286d1e59b97c283c0b8c949994c361e426a28f743c67bdfe9a32f': 'tBTC',
    '0x593e034dda23eea82d2ba9a30960ed42cf4a01502cc2351dc9b9881f9931a68': 'solvBTC',
    '0x36834a40984312f7f7de8d31e3f6305b325389eaeea5b1c0664b2fb936461a4': 'LBTC'
};

interface Investment {
    category: string;
    stakerInfo?: { name?: string };
    investableAssets?: { tokenAddresses?: string[] };
    metrics?: { totalApy?: string };
    withdrawableAssets?: { timelockDuration?: number };
}

interface Response {
    investments: Investment[];
}

/** "0x04718f…" and "0x4718f…" are the same address. */
const normalizeAddress = (address: string) => `0x${address.toLowerCase().replace(/^0x0*/, '')}`;

const symbolOf = (investment: Investment) => {
    const address = investment.investableAssets?.tokenAddresses?.[0];
    return address ? TOKENS[normalizeAddress(address)] ?? null : null;
};

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
