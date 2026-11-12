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
