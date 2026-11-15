import { storage } from 'wxt/utils/storage';
import type { Rate } from './exchanges/common';

// Everything lives in storage.local: it stays on this machine and is readable only by the extension.

export interface Settings {
    botToken: string;
    chatId: string;
    /** Notify when a coin's best APR grows by at least this many percentage points. */
    minIncrease: number;
    intervalHours: number;
    /** No alerts for coins worth less than this in the counted portfolios, USD (coins kept just to watch). */
    minPositionUsd: number;
    /** Also notify about short promos (fixed terms of 14 days or less) from this APR, %. */
    promoAlerts: boolean;
    minPromoApr: number;
    /** A weekly Telegram summary: income now vs at the best rates, the best moves, running promos. */
    weeklyDigest: boolean;
    /** Day of the week for the summary, 0 = Sunday (Date.getDay); sent with the first check after 9:00. */
    digestDay: number;
    /** Refresh BingX rates before each check by opening its Earn page in a background tab for a few seconds. */
    bingxAutoRefresh: boolean;
    /** CMC portfolio names left out of the totals banner (e.g. savings), matched case-insensitively. */
    excludedPortfolios: string[];
    /** CMC portfolio name -> exchange id or 'none' (wallet / other). Unset portfolios are guessed by name. */
    portfolioExchanges: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
    botToken: '',
    chatId: '',
    minIncrease: 1,
    intervalHours: 4,
    minPositionUsd: 10,
    promoAlerts: true,
    minPromoApr: 50,
    weeklyDigest: true,
    digestDay: 1,
    bingxAutoRefresh: false,
    excludedPortfolios: [],
    portfolioExchanges: {}
};

/** Settings with defaults filled in for keys added after the user first saved them. */
export async function getSettings(): Promise<Settings> {
    return { ...DEFAULT_SETTINGS, ...await settingsItem.getValue() };
}

export interface BestRate {
    apr: number;
    days: number;
    unbondingDays?: number;
    exchangeId: string;
    exchangeName: string;
}

export interface CheckStatus {
    at: number;
    ok: boolean;
    message: string;
    failedExchanges: string[];
}

export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });

/** Lower-case coin symbol -> when it was last seen in the CMC portfolio (ms). */
export const portfolioItem = storage.defineItem<Record<string, number>>('local:portfolio', { fallback: {} });

/** Exchange id -> the best rate that exchange offered for a coin. */
export type CoinSnapshot = Record<string, BestRate>;

/**
 * Lower-case coin symbol -> per-exchange best rates at the previous check; the baseline for "new best rate".
 * Kept per exchange so an exchange that's temporarily down can carry its last known rate.
 */
export const knownRatesItem = storage.defineItem<Record<string, CoinSnapshot>>('local:knownRates', { fallback: {} });

/** Names of the user's CMC portfolios, as last seen on coinmarketcap.com (for the settings page). */
export const knownPortfoliosItem = storage.defineItem<string[]>('local:knownPortfolios', { fallback: [] });

/** Lower-case coin symbol -> positions (portfolio name, USD value), as last seen on CMC; for personal alerts. */
type StoredHolding = { portfolio: string; value: number; balance?: number };

export const holdingsItem = storage.defineItem<Record<string, StoredHolding[]>>(
    'local:holdings',
    { fallback: {} }
);

/** "symbol|exchangeId|days" -> APR of the short promos already announced; a promo that ends is dropped. */
export const knownPromosItem = storage.defineItem<Record<string, number>>('local:knownPromos', { fallback: {} });

/**
 * BingX rates as last read from its Earn page (it has no public API: the page signs its own requests,
 * the extension only reads the response). Lower-case symbol -> rates.
 */
export interface BingxRates {
    at: number;
    rates: Record<string, Rate[]>;
}

/** Also read directly as chrome.storage.local 'bingxRates' in lib/exchanges/bingx.ts. */
export const bingxRatesItem = storage.defineItem<BingxRates | null>('local:bingxRates', { fallback: null });

/** Exchange id -> its rates as last loaded (lib/ratesCache.ts): lower-case symbol -> rates. */
export interface CachedExchangeRates {
    at: number;
    coins: Record<string, Rate[]>;
}

export const ratesCacheItem = storage.defineItem<Record<string, CachedExchangeRates>>(
    'local:ratesCache',
    { fallback: {} }
);

/** When the weekly summary was last sent (ms). */
export const lastDigestItem = storage.defineItem<number | null>('local:lastDigest', { fallback: null });

export const lastCheckItem = storage.defineItem<CheckStatus | null>('local:lastCheck', { fallback: null });
