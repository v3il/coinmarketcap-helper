/** Sent by the settings page to run a rate check in the background worker right away. */
export const CHECK_NOW_MESSAGE = 'cmc-helper:check-now';

/**
 * Sent by the content script with the coins visible in the CMC portfolio. The worker stores them,
 * so the content script itself never touches extension storage (where the bot token lives).
 */
export const PORTFOLIO_MESSAGE = 'cmc-helper:portfolio';

export interface PortfolioMessage {
    type: typeof PORTFOLIO_MESSAGE;
    symbols: string[];
}

/** Content script → worker: the settings the content script needs (never the bot token). */
export const PAGE_SETTINGS_MESSAGE = 'cmc-helper:page-settings';

export interface PageSettings {
    excludedPortfolios: string[];
    portfolioExchanges: Record<string, string>;
}

/** Worker → CMC tabs: settings changed, re-render what depends on them. */
export const PAGE_SETTINGS_CHANGED_MESSAGE = 'cmc-helper:page-settings-changed';

/** Content script → worker: names of the user's CMC portfolios (names only), for the settings page. */
export const PORTFOLIO_NAMES_MESSAGE = 'cmc-helper:portfolio-names';

export interface PortfolioNamesMessage {
    type: typeof PORTFOLIO_NAMES_MESSAGE;
    names: string[];
}

/** Content script → worker: where each portfolio coin is held, for personal Telegram alerts. */
export const HOLDINGS_MESSAGE = 'cmc-helper:holdings';

export interface HoldingsMessage {
    type: typeof HOLDINGS_MESSAGE;
    /** Lower-case symbol -> positions (portfolio name, USD value). */
    holdings: Record<string, { portfolio: string; value: number }[]>;
}
