// Average price calculator: what buying more of a coin does to its average price and drawdown.
// The cost is CMC's (value − P/L), so the average is the break-even price: free coins and past profits lower it.

/** A position in one portfolio: how many coins and what they cost, USD. */
export interface Position {
    coins: number;
    cost: number;
}

export interface PositionStats {
    /** Cost per coin, USD; null when there's nothing to average (no coins, or the position is paid back). */
    average: number | null;
    /** Price vs the average as a fraction: −0.42 = 42% down, 0.1 = 10% up; null with the average. */
    change: number | null;
}

export function positionStats({ coins, cost }: Position, price: number): PositionStats {
    if (coins <= 0 || cost <= 0) {
        return { average: null, change: null };
    }

    const average = cost / coins;
    return { average, change: price / average - 1 };
}

/** The position after buying for `usd` at the current price. */
export function afterBuy({ coins, cost }: Position, price: number, usd: number): Position {
    return { coins: coins + usd / price, cost: cost + usd };
}

/**
 * "1,000", " $250 ", "12.5" → a positive number of dollars; null for anything else. Commas in thousands groups
 * ("1,000.5") separate thousands; any other single comma ("12,5") is the decimal point.
 */
export function parseUsd(text: string): number | null {
    const trimmed = text.replace(/[\s_$]/g, '');
    const clean = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)
        ? trimmed.replace(/,/g, '')
        : trimmed.replace(/^(\d+),(\d+)$/, '$1.$2');

    if (!/^\d+(\.\d+)?$/.test(clean)) {
        return null;
    }

    const value = Number(clean);
    return value > 0 ? value : null;
}

export const formatPrice = (value: number) => (value >= 1 ? value.toFixed(2) : value.toPrecision(4));

/** 1234.5678 → "1234.57", 20 → "20", 0.012345 → "0.01235". */
export const formatCoins = (value: number) => String(Number(value >= 1 ? value.toFixed(2) : value.toPrecision(4)));

/** −0.42 → "−42.0%", 0.1 → "+10.0%". */
export function formatChange(change: number): string {
    const text = `${Math.abs(change * 100).toFixed(1)}%`;

    if (text === '0.0%') {
        return text;
    }

    return `${change < 0 ? '−' : '+'}${text}`;
}
