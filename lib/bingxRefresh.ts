import { BINGX_EARN_URL, parseBingxProducts, type BingxAsset } from './exchanges/bingx';
import { bingxRatesItem } from './storage';

/** How long to wait for the background tab to load the product list before giving up. */
const TIMEOUT_MS = 45_000;

let waiters: (() => void)[] = [];

/** Saves the product list caught on a BingX page (the user's own visit or the background tab). */
export async function saveBingxProducts(result: unknown) {
    if (!Array.isArray(result) || result.length === 0) {
        return;
    }

    const rates = parseBingxProducts(result as BingxAsset[]);

    if (rates.size === 0) {
        return;
    }

    await bingxRatesItem.setValue({ at: Date.now(), rates: Object.fromEntries(rates) });
    waiters.forEach((resolve) => resolve());
    waiters = [];
}

let running: Promise<boolean> | null = null;

/**
 * Opens the BingX Earn page in a background tab (no focus change), waits until its product list is saved
 * and closes the tab. Resolves to whether fresh rates arrived. Concurrent calls share one tab.
 */
export function refreshBingx(): Promise<boolean> {
    running ??= (async () => {
        let tabId: number | undefined;
        let timer: ReturnType<typeof setTimeout> | undefined;

        try {
            const saved = new Promise<boolean>((resolve) => {
                waiters.push(() => resolve(true));
                timer = setTimeout(() => resolve(false), TIMEOUT_MS);
            });

            tabId = (await chrome.tabs.create({ url: BINGX_EARN_URL, active: false })).id;
            return await saved;
        } catch (error) {
            console.warn('[cmc-helper] BingX refresh failed', error);
            return false;
        } finally {
            clearTimeout(timer);

            if (tabId !== undefined) {
                chrome.tabs.remove(tabId).catch(() => {});
            }
        }
    })().finally(() => {
        running = null;
    });

    return running;
}
