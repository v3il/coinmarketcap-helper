import { EXCHANGES } from '@/lib/exchanges';
import { exchangeResolver, type HoldingsByCoin } from '@/lib/holdings';
import {
    HOLDINGS_MESSAGE,
    PAGE_SETTINGS_CHANGED_MESSAGE,
    PORTFOLIO_MESSAGE,
    type HoldingsMessage,
    type PageSettings,
    type PortfolioMessage
} from '@/lib/messages';
import { loadRates, type LoadedRates } from '@/lib/rates';
import { loadHoldings } from './holdings';
import { invalidatePageSettings, loadPageSettings } from './pageSettings';
import {
    areBalancesHidden, getPortfolioTableSymbols, hasPortfolioTable, renderEarnColumn
} from './render';
import { invalidateTotals, renderTotalsBanner } from './totals';
import './styles.css';

const isPortfolioPage = () => window.location.pathname.startsWith('/portfolio-tracker');

export function main() {
    // CoinMarketCap is an SPA, so the script runs on every page and loads rates lazily,
    // the first time a portfolio table shows up (or right away on a direct portfolio visit).
    let rates: Promise<LoadedRates> | undefined = isPortfolioPage() ? loadRates(EXCHANGES) : undefined;
    let reportedSymbols = '';
    let scheduled = false;

    // Holdings and settings arrive asynchronously; each new value bumps the version so cells re-render.
    let holdings: HoldingsByCoin | null = null;
    let holdingsPromise: Promise<HoldingsByCoin | null> | undefined;
    let settings: PageSettings | null = null;
    let settingsPromise: Promise<PageSettings> | undefined;
    let version = 0;

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

    const reportHoldings = (value: HoldingsByCoin) => {
        const message: HoldingsMessage = { type: HOLDINGS_MESSAGE, holdings: Object.fromEntries(value) };
        chrome.runtime.sendMessage(message).catch(() => {});
    };

    let scheduleUpdate = () => {};

    // Start (or reuse) loads; when a fresh result arrives, store it and render again.
    const refreshData = () => {
        const nextHoldings = loadHoldings();

        if (nextHoldings !== holdingsPromise) {
            holdingsPromise = nextHoldings;
            nextHoldings.then((value) => {
                holdings = value;
                version++;

                if (value) {
                    reportHoldings(value);
                }

                scheduleUpdate();
            });
        }

        const nextSettings = loadPageSettings();

        if (nextSettings !== settingsPromise) {
            settingsPromise = nextSettings;
            nextSettings.then((value) => {
                settings = value;
                version++;
                scheduleUpdate();
            });
        }
    };

    const update = async () => {
        scheduled = false;

        if (!hasPortfolioTable()) {
            return;
        }

        reportPortfolio();
        renderTotalsBanner();
        refreshData();
        rates ??= loadRates(EXCHANGES);

        const hidden = areBalancesHidden();

        renderEarnColumn({
            rates: (await rates).byCoin,
            holdings,
            resolveExchange: exchangeResolver(settings?.portfolioExchanges),
            hidden,
            version: `${version}|${hidden}`
        });
    };

    scheduleUpdate = () => {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(update);
        }
    };

    // Our own insertions also trigger the observer; renders are idempotent, so that's a no-op.
    new MutationObserver(scheduleUpdate).observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true
    });

    // Settings changed in the extension (excluded portfolios, portfolio exchanges): recompute everything.
    chrome.runtime.onMessage.addListener((message: { type?: string }) => {
        if (message?.type === PAGE_SETTINGS_CHANGED_MESSAGE) {
            invalidatePageSettings();
            invalidateTotals();
            scheduleUpdate();
        }
    });

    scheduleUpdate();
}
