// Exchange rates for the CMC page and the Telegram checks, loaded by the worker and kept in storage.local, so
// opening a portfolio doesn't fire ~90 requests (most of them WhiteBIT fixed plans) every time.

import { EXCHANGES, type CoinRates, type Exchange } from './exchanges';
import { deserializeRates, type LoadedRates, type SerializedRates } from './rates';
import { ratesCacheItem, type CachedExchangeRates } from './storage';

/** The CMC page reuses rates up to this old; the checks in the background take fresher ones. */
export const PAGE_MAX_AGE_MS = 30 * 60_000;
export const CHECK_MAX_AGE_MS = 5 * 60_000;
/** Older cached rates are shown while fresh ones load in the background, up to this age. */
const STALE_MAX_AGE_MS = 24 * 60 * 60_000;

/** Concurrent loads of one exchange (the page and a check at once) share one request. */
const inFlight = new Map<string, Promise<CoinRates>>();

/** Cache writes one at a time: each one reads, changes one exchange and writes back. */
let writes = Promise.resolve();

function save(id: string, entry: CachedExchangeRates) {
    writes = writes.then(async () => {
        const cache = await ratesCacheItem.getValue();
        await ratesCacheItem.setValue({ ...cache, [id]: entry });
    }).catch((error) => console.warn('[cmc-helper] rates cache: write failed', error));
}

function loadFresh(exchange: Exchange): Promise<CoinRates> {
    let loading = inFlight.get(exchange.id);

    if (!loading) {
        loading = exchange.loadRates().then((coins) => {
            if (!exchange.local) {
                save(exchange.id, { at: Date.now(), coins: Object.fromEntries(coins) });
            }

            return coins;
        }).finally(() => inFlight.delete(exchange.id));
        inFlight.set(exchange.id, loading);
    }

    return loading;
}

/**
 * Rates of every exchange: from the cache when not older than `maxAgeMs`, otherwise loaded now.
 * With `stale`, older cached rates (up to a day) are returned right away and reloaded in the background, so the
 * page never waits for the network unless there's nothing cached at all; an exchange that is down keeps showing
 * its last rates the same way.
 */
export async function getRates(maxAgeMs: number, stale = false): Promise<SerializedRates> {
    const cache = await ratesCacheItem.getValue();
    const now = Date.now();

    const results = await Promise.allSettled(EXCHANGES.map(async (exchange) => {
        const cached = exchange.local ? undefined : cache[exchange.id];

        if (cached && now - cached.at < maxAgeMs) {
            return cached.coins;
        }

        if (stale && cached && now - cached.at < STALE_MAX_AGE_MS) {
            loadFresh(exchange).catch((error) => console.warn(`[cmc-helper] ${exchange.name}: refresh failed`, error));
            return cached.coins;
        }

        try {
            return Object.fromEntries(await loadFresh(exchange));
        } catch (error) {
            console.error(`[cmc-helper] ${exchange.name}: failed to load rates`, error);
            throw error;
        }
    }));

    const serialized: SerializedRates = { loaded: [], failed: [] };

    results.forEach((result, index) => {
        const { id } = EXCHANGES[index];

        if (result.status === 'fulfilled') {
            serialized.loaded.push({ id, coins: result.value });
        } else {
            serialized.failed.push(id);
        }
    });

    return serialized;
}

/** For the worker itself: rates as Maps. */
export async function loadCachedRates(maxAgeMs: number, stale = false): Promise<LoadedRates> {
    return deserializeRates(await getRates(maxAgeMs, stale));
}
