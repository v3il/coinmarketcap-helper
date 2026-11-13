import type { HoldingsByCoin } from '@/lib/holdings';
import { fetchHoldings } from './cmcApi';

const CACHE_TTL_MS = 2 * 60 * 1000;
/** After a failed load, wait this long before trying again. */
const RETRY_AFTER_MS = 30 * 1000;

let cache: { at: number; ttl: number; promise: Promise<HoldingsByCoin | null> } | null = null;

/**
 * Where each coin is held (portfolio and value), from CMC. Cached for a couple of minutes;
 * returns the same promise while cached, so callers can tell when fresh data arrived.
 */
export function loadHoldings(): Promise<HoldingsByCoin | null> {
    if (cache && Date.now() - cache.at < cache.ttl) {
        return cache.promise;
    }

    const entry = { at: Date.now(), ttl: CACHE_TTL_MS, promise: Promise.resolve<HoldingsByCoin | null>(null) };

    entry.promise = fetchHoldings().catch((error) => {
        console.warn('[cmc-helper] Failed to load holdings', error);
        entry.ttl = RETRY_AFTER_MS;
        return null;
    });

    cache = entry;
    return entry.promise;
}
