import { BINGX_RATES_MESSAGE } from '@/lib/messages';
import type { BingxRates } from '@/lib/storage';
import { toRates, type CoinRates, type Exchange, type Rate } from './common';

// BingX has no public earn API and its website signs every request, so the extension doesn't call it.
// Instead, a script on bingx.com reads the product list the Earn page loads itself (see entrypoints/bingx-*.ts):
// whenever the user opens the page, or in a background tab before each check if enabled in the settings.

export const BINGX_EARN_URL = 'https://bingx.com/en/wealth/earn';

/** Saved rates older than this are treated as unavailable rather than shown as current. */
export const BINGX_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const FLEXIBLE = 2;
const FIXED = 1;

/** Offers not open to everyone. */
const RESTRICTED_TAGS = ['new user', 'vip'];

export interface BingxProduct {
    productType: number;
    /** Days; -1 for flexible. */
    duration: number;
    apy: string;
    soldOut: number;
    tags?: { tagDesc?: string }[];
    tieredApyRule?: { rules: { low: string; high: string; apy: string }[] };
}

export interface BingxAsset {
    assetName: string;
    products: BingxProduct[];
}

const isOpenToAll = (product: BingxProduct) => !(product.tags ?? [])
    .some(({ tagDesc }) => RESTRICTED_TAGS.includes((tagDesc ?? '').toLowerCase()));

function toRate(product: BingxProduct): Rate {
    const rate: Rate = {
        apr: Number.parseFloat(product.apy),
        days: product.productType === FLEXIBLE ? 0 : product.duration
    };
    const tiers = (product.tieredApyRule?.rules ?? [])
        .map(({ low, high, apy }) => ({ from: Number(low), to: Number(high), apr: Number.parseFloat(apy) }))
        .filter(({ from, to, apr }) => Number.isFinite(from) && Number.isFinite(to) && Number.isFinite(apr));

    return tiers.length > 1 ? { ...rate, tiers } : rate;
}

/** Flexible and fixed products open to everyone; structured ones (Shark Fin), sold out and new-user/VIP skipped. */
export function parseBingxProducts(assets: BingxAsset[]): CoinRates {
    return toRates(assets, (asset) => asset.products
        .filter((product) => [FLEXIBLE, FIXED].includes(product.productType))
        .filter((product) => product.soldOut !== 1 && isOpenToAll(product))
        .map((product) => [asset.assetName, toRate(product)]));
}

const isContentScript = () => typeof window !== 'undefined' && window.location.protocol !== 'chrome-extension:';

async function loadSaved(): Promise<BingxRates | null> {
    // The CMC content script never reads extension storage itself (the bot token lives there).
    if (isContentScript()) {
        return chrome.runtime.sendMessage({ type: BINGX_RATES_MESSAGE });
    }

    // Plain chrome.storage (key of bingxRatesItem), so this module doesn't pull the storage module into the
    // CMC content script bundle.
    const { bingxRates } = await chrome.storage.local.get('bingxRates');
    return (bingxRates as BingxRates | undefined) ?? null;
}

export const bingx: Exchange = {
    id: 'bingx',
    name: 'BingX',
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/1064.png',

    async loadRates() {
        const saved = await loadSaved();

        if (!saved || Date.now() - saved.at > BINGX_MAX_AGE_MS) {
            throw new Error(`no recent rates: open ${BINGX_EARN_URL}`);
        }

        return new Map(Object.entries(saved.rates));
    }
};
