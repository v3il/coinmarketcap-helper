// Price jumps: a coin up by a lot since the previous check (lottery coins held until an altseason), so the user
// can look at it and decide, e.g. take part of the profit.

import { escapeHtml } from './telegram';

export interface PriceBaseline {
    price: number;
    at: number;
}

export interface Jump {
    symbol: string;
    /** Rise since the baseline, %. */
    percent: number;
    /** When the baseline price was seen (ms). */
    since: number;
}

export interface JumpAlert extends Jump {
    portfolios: string[];
    /** Profit/loss of the whole position at the new price, %; null when the cost isn't known. */
    position: number | null;
}

/** Coins whose price rose by at least `minPercent` since their baseline. Coins without a baseline or price: none. */
export function findJumps(
    prices: Map<string, number>,
    baselines: Record<string, PriceBaseline>,
    minPercent: number
): Jump[] {
    return [...prices].flatMap(([symbol, price]) => {
        const baseline = baselines[symbol];

        if (!baseline || baseline.price <= 0) {
            return [];
        }

        const percent = (price / baseline.price - 1) * 100;
        return percent >= minPercent ? [{ symbol, percent, since: baseline.at }] : [];
    });
}

/** P/L of a coin's positions at `price`, % of what was put in; null unless every position's cost is known. */
export function positionPercent(positions: { balance?: number; cost?: number }[], price: number): number | null {
    if (positions.length === 0 || positions.some(({ balance, cost }) => balance === undefined || cost === undefined)) {
        return null;
    }

    const cost = positions.reduce((sum, position) => sum + (position.cost ?? 0), 0);
    const value = positions.reduce((sum, position) => sum + (position.balance ?? 0), 0) * price;

    // Rewards and airdrops cost nothing: a percentage of zero means nothing.
    return cost > 0 ? ((value - cost) / cost) * 100 : null;
}

const HOUR = 3600_000;

const ago = (ms: number) => {
    const hours = Math.max(1, Math.round(ms / HOUR));

    if (hours < 36) {
        return `${hours} h ago`;
    }

    return `${Math.round(hours / 24)} days ago`;
};

const signed = (percent: number) => `${percent >= 0 ? '+' : '−'}${Math.abs(Math.round(percent))}%`;

/**
 * 🚀 Price jump
 * 🪙 XYZ +42% since the last check (6 h ago)
 * 💼 Trash · your position +180%
 */
export function formatJumps(jumps: JumpAlert[], now: number): string {
    const blocks = jumps.map(({ symbol, percent, since, portfolios, position }) => [
        `🪙 <b>${escapeHtml(symbol.toUpperCase())}</b> ${signed(percent)} since the last check (${ago(now - since)})`,
        `💼 ${portfolios.map(escapeHtml).join(', ')}${position === null ? '' : ` · your position ${signed(position)}`}`
    ].join('\n'));

    return [`<b>🚀 Price ${jumps.length === 1 ? 'jump' : 'jumps'}</b>`, ...blocks].join('\n\n');
}
