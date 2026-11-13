import { storage } from 'wxt/utils/storage';

// Everything lives in storage.local: it stays on this machine and is readable only by the extension.

export interface Settings {
    botToken: string;
    chatId: string;
    /** Notify when a coin's best APR grows by at least this many percentage points. */
    minIncrease: number;
    intervalHours: number;
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
export const holdingsItem = storage.defineItem<Record<string, { portfolio: string; value: number }[]>>(
    'local:holdings',
    { fallback: {} }
);

export const lastCheckItem = storage.defineItem<CheckStatus | null>('local:lastCheck', { fallback: null });
