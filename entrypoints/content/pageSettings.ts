import { PAGE_SETTINGS_MESSAGE, type PageSettings } from '@/lib/messages';

const EMPTY: PageSettings = { excludedPortfolios: [], portfolioExchanges: {} };

let cache: Promise<PageSettings> | null = null;

/**
 * The extension settings the CMC page needs, asked from the worker (the content script never reads
 * extension storage, where the bot token lives). Cached until the settings change.
 */
export function loadPageSettings(): Promise<PageSettings> {
    cache ??= chrome.runtime.sendMessage({ type: PAGE_SETTINGS_MESSAGE })
        .then((response: Partial<PageSettings> | undefined) => ({ ...EMPTY, ...response }))
        .catch((error) => {
            console.warn('[cmc-helper] Failed to load settings', error);
            cache = null;
            return EMPTY;
        });

    return cache;
}

export function invalidatePageSettings() {
    cache = null;
}
