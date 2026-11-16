import type { CoinSnapshot } from './storage';

const exchangeIds = (snapshots: Record<string, CoinSnapshot>) => new Set(
    Object.values(snapshots).flatMap((snapshot) => Object.keys(snapshot))
);

/**
 * Exchanges that show up for the first time (added in an update): no previous baseline has them. Their rates
 * become a silent baseline instead of a burst of "new best rate" alerts. Empty on a fresh install, where every
 * coin is new anyway.
 */
export function findNewExchanges(
    previous: Record<string, CoinSnapshot>,
    current: Record<string, CoinSnapshot>
): Set<string> {
    const known = exchangeIds(previous);

    if (known.size === 0) {
        return new Set();
    }

    return new Set([...exchangeIds(current)].filter((id) => !known.has(id)));
}

export const withoutExchanges = (snapshot: CoinSnapshot, ids: Set<string>): CoinSnapshot => (
    Object.fromEntries(Object.entries(snapshot).filter(([id]) => !ids.has(id)))
);
