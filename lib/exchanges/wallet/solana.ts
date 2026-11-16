import { fetchJson } from '@/utils/request';
import type { Rate } from '../common';
import { netOfFee } from './fee';
import type { NetworkModule } from './types';

// Native SOL staking from the public Solana RPC: new coins (validator inflation × total supply) are shared among
// the staked coins. MEV tips some validators add on top aren't counted.
const RPC = 'https://api.mainnet-beta.solana.com';
/** Deactivating stake takes an epoch (~2–3 days). */
const UNBONDING_DAYS = 3;

/** Gross inflation for validators (fraction), supply and active stake (any unit) -> net percent. */
export function solanaApr(inflationValidator: number, totalSupply: number, activeStake: number): number {
    return activeStake > 0 ? netOfFee((inflationValidator * totalSupply) / activeStake) : 0;
}

export const solanaRate = (apr: number): Rate => ({ apr, days: 0, unbondingDays: UNBONDING_DAYS, approximate: true });

async function rpc<T>(method: string, params?: unknown[]): Promise<T> {
    const response = await fetchJson<{ result?: T; error?: { message: string } }>(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) })
    });

    if (response.result === undefined) {
        throw new Error(`Solana ${method}: ${response.error?.message ?? 'no result'}`);
    }

    return response.result;
}

type VoteAccount = { activatedStake: number };

export const solana: NetworkModule = {
    name: 'Solana',
    async load() {
        const [inflation, supply, votes] = await Promise.all([
            rpc<{ validator: number }>('getInflationRate'),
            rpc<{ value: { total: number } }>('getSupply', [{ excludeNonCirculatingAccountsList: true }]),
            rpc<{ current: VoteAccount[]; delinquent: VoteAccount[] }>('getVoteAccounts')
        ]);
        const stake = [...votes.current, ...votes.delinquent]
            .reduce((sum, { activatedStake }) => sum + activatedStake, 0);
        const apr = solanaApr(inflation.validator, supply.value.total, stake);

        return apr > 0 ? [['SOL', solanaRate(apr)]] : [];
    }
};
