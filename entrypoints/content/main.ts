import { EXCHANGES } from '@/lib/exchanges';
import { PORTFOLIO_MESSAGE, type PortfolioMessage } from '@/lib/messages';
import { loadRates, type LoadedRates } from '@/lib/rates';
import { getPortfolioTableSymbols, hasPortfolioTable, renderEarnColumn } from './render';
import { renderTotalsBanner } from './totals';
import './styles.css';

const isPortfolioPage = () => window.location.pathname.startsWith('/portfolio-tracker');

export function main() {
    // CoinMarketCap is an SPA, so the script runs on every page and loads rates lazily,
    // the first time a portfolio table shows up (or right away on a direct portfolio visit).
    let rates: Promise<LoadedRates> | undefined = isPortfolioPage() ? loadRates(EXCHANGES) : undefined;
    let reportedSymbols = '';
    let scheduled = false;

    // Tell the worker which coins are in the portfolio, so it can watch them for Telegram alerts.
    const reportPortfolio = () => {
        const symbols = getPortfolioTableSymbols();
        const key = symbols.join(',');

        if (symbols.length > 0 && key !== reportedSymbols) {
            reportedSymbols = key;
            const message: PortfolioMessage = { type: PORTFOLIO_MESSAGE, symbols };
            chrome.runtime.sendMessage(message);
        }
    };

    const update = async () => {
        scheduled = false;

        if (!hasPortfolioTable()) {
            return;
        }

        reportPortfolio();
        renderTotalsBanner();
        rates ??= loadRates(EXCHANGES);
        renderEarnColumn((await rates).byCoin);
    };

    const scheduleUpdate = () => {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(update);
        }
    };

    // Our own insertions also trigger the observer; renderEarnColumn is idempotent, so that's a no-op.
    new MutationObserver(scheduleUpdate).observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true
    });

    scheduleUpdate();
}
