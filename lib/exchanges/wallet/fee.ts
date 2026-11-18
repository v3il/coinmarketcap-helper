import type { Rate } from '../common';

/** Validators keep a commission (usually 5–20%) of the network's staking rewards; assume a typical 10%. */
export const VALIDATOR_FEE = 0.1;

/** A network's gross staking rate (fraction, 0.05 = 5%) -> percent the delegator gets after the fee (4.5). */
export const netOfFee = (grossFraction: number) => Math.round(grossFraction * (1 - VALIDATOR_FEE) * 10000) / 100;

/** A network staking rate: flexible with an unbonding period, approximate, and where to stake in its tooltip. */
export function stakingRate(
    apr: number,
    unbondingDays: number,
    { network, wallets, note }: { network: string; wallets: string[]; note?: string }
): Rate {
    const where = `Native staking on ${network}: ${wallets.join(', ')}`;
    return { apr, days: 0, unbondingDays, approximate: true, note: note ? `${where}\n${note}` : where };
}
