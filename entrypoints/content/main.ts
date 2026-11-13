import { EXCHANGES } from '@/lib/exchanges';
import { exchangeResolver } from '@/lib/holdings';
import {
    HOLDINGS_MESSAGE,
    PAGE_SETTINGS_CHANGED_MESSAGE,
    PORTFOLIO_MESSAGE,
    type HoldingsMessage,
    type PageSettings,
    type PortfolioMessage
} from '@/lib/messages';
import { loadRates, type LoadedRates } from '@/lib/rates';
import { renderAmountEditors } from './amountEditor';
import type { PortfolioSnapshot } from './cmcApi';
import { invalidateHoldings, loadHoldings } from './holdings';
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
    let snapshot: PortfolioSnapshot | null = null;
    let snapshotPromise: Promise<PortfolioSnapshot | null> | undefined;
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

    // Only portfolio names and values go to the worker (for alerts), not the exact amounts.
    const reportHoldings = (value: PortfolioSnapshot) => {
        const holdings = Object.fromEntries([...value.holdings].map(([symbol, places]) => [
            symbol,
            places.map(({ portfolio, value: usd }) => ({ portfolio, value: usd }))
        ]));
        const message: HoldingsMessage = { type: HOLDINGS_MESSAGE, holdings };
        chrome.runtime.sendMessage(message).catch(() => {});
    };

    let scheduleUpdate = () => {};

    // Start (or reuse) loads; when a fresh result arrives, store it and render again.
    const refreshData = () => {
        const nextSnapshot = loadHoldings();

        if (nextSnapshot !== snapshotPromise) {
            snapshotPromise = nextSnapshot;
            nextSnapshot.then((value) => {
                snapshot = value;
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

        if (snapshot) {
            renderAmountEditors({ snapshot, hidden, onAdded: refreshAfterTransaction });
        }

        renderEarnColumn({
            rates: (await rates).byCoin,
            holdings: snapshot?.holdings ?? null,
            resolveExchange: exchangeResolver(settings?.portfolioExchanges),
            hidden,
            version: `${version}|${hidden}`
        });
    };

    // A transaction was added: reload CMC's current view (re-select the current sidebar item) and our own data.
    function refreshAfterTransaction() {
        invalidateHoldings();
        invalidateTotals();

        // The selected sidebar item (a portfolio or the overview) is the one styled differently from its siblings.
        const items = [...document.querySelectorAll<HTMLElement>('[data-rbd-draggable-id]')];
        const counts = new Map<string, number>();
        items.forEach((item) => counts.set(item.className, (counts.get(item.className) ?? 0) + 1));
        const selected = items.length > 1 ? items.find((item) => counts.get(item.className) === 1) : undefined;
        const overview = [...document.querySelectorAll<HTMLElement>('div, span, p')].find((el) => (
            el.childElementCount === 0 && el.textContent?.trim() === 'Overview'
            && !el.closest('header, nav, [data-test^="global-header"]')
        ));
        const target = selected?.querySelector<HTMLElement>('.name') ?? overview;

        if (target) {
            target.click();
        } else {
            window.location.reload();
        }

        scheduleUpdate();
    }

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
