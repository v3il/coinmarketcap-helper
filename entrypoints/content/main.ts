import { exchangeResolver, withoutExcluded } from '@/lib/holdings';
import { portfolioIcon } from '@/lib/portfolioIcons';
import {
    FAVORITE_TOGGLE_MESSAGE,
    FAVORITES_CHANGED_MESSAGE,
    HOLDINGS_MESSAGE,
    PAGE_SETTINGS_CHANGED_MESSAGE,
    PORTFOLIO_MESSAGE,
    RATES_MESSAGE,
    type FavoriteToggleMessage,
    type HoldingsMessage,
    type PageSettings,
    type PortfolioMessage
} from '@/lib/messages';
import { deserializeRates, type LoadedRates, type SerializedRates } from '@/lib/rates';
import { renderAmountEditors } from './amountEditor';
import { renderBuyList } from './buyList';
import type { PortfolioSnapshot, PositionCosts } from './cmcApi';
import { invalidateHoldings, loadHoldings, loadPositionCosts } from './holdings';
import { invalidatePageSettings, loadPageSettings } from './pageSettings';
import { renderPortfolioIcons } from './portfolioIcons';
import {
    areBalancesHidden, getPortfolioTableSymbols, hasPortfolioTable, renderEarnColumn
} from './render';
import { invalidateTotals, renderTotalsBanner } from './totals';
import './styles.css';

/** Rates come from the worker, which caches them for a while (lib/ratesCache.ts). */
async function requestRates(): Promise<LoadedRates> {
    const response: SerializedRates | undefined = await chrome.runtime.sendMessage({ type: RATES_MESSAGE });
    return deserializeRates(response ?? { loaded: [], failed: [] });
}

const isPortfolioPage = () => window.location.pathname.startsWith('/portfolio-tracker');

export function main() {
    // CoinMarketCap is an SPA, so the script runs on every page and loads rates lazily,
    // the first time a portfolio table shows up (or right away on a direct portfolio visit).
    let rates: Promise<LoadedRates> | undefined = isPortfolioPage() ? requestRates() : undefined;
    let reportedSymbols = '';
    let scheduled = false;

    // Holdings and settings arrive asynchronously; each new value bumps the version so cells re-render.
    let snapshot: PortfolioSnapshot | null = null;
    let snapshotPromise: Promise<PortfolioSnapshot | null> | undefined;
    // What each position cost: for the average price calculator.
    let costs: PositionCosts | null = null;
    let costsPromise: Promise<PositionCosts> | undefined;
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

    // Positions for personal Telegram alerts (kept in the extension's local storage).
    const reportHoldings = async (value: PortfolioSnapshot) => {
        const positionCosts = await loadPositionCosts();
        const holdings = Object.fromEntries([...value.holdings].map(([symbol, places]) => [
            symbol,
            places.map(({ portfolio, value: usd, balance }) => {
                const cost = positionCosts.get(symbol)?.get(portfolio);
                return { portfolio, value: usd, balance, ...(cost === undefined ? {} : { cost }) };
            })
        ]));
        const coinIds = Object.fromEntries([...value.coins].map(([symbol, { id }]) => [symbol, id]));
        const message: HoldingsMessage = { type: HOLDINGS_MESSAGE, holdings, coinIds };
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

        const nextCosts = loadPositionCosts();

        if (nextCosts !== costsPromise) {
            costsPromise = nextCosts;
            nextCosts.then((value) => {
                costs = value;
                version++;
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
        rates ??= requestRates();

        const hidden = areBalancesHidden();

        if (snapshot) {
            renderAmountEditors({ snapshot, costs, hidden, onAdded: refreshAfterTransaction });
        }

        if (settings) {
            renderBuyList({ favorites: new Set(settings.favorites), onToggle: toggleFavorite });
        }

        // Logos need the settings: a portfolio's exchange binding decides its logo (no guessing before they load).
        if (settings) {
            const resolveIcon = exchangeResolver(settings.portfolioExchanges);
            renderPortfolioIcons({
                enabled: settings.portfolioLogos,
                iconOf: (name) => portfolioIcon(name, resolveIcon(name), (path) => chrome.runtime.getURL(path)),
                order: snapshot?.portfolioOrder ?? null
            });
        }

        // Read holdings, settings and version only after the await: they may arrive meanwhile, and the version
        // must match the data rendered with it (cells with the current version are never re-rendered).
        const { byCoin } = await rates;

        // Unchecked portfolios don't count in the income estimate either.
        const excluded = settings?.excludedPortfolios ?? [];
        const counted = snapshot && new Map([...snapshot.holdings]
            .map(([symbol, places]) => [symbol, withoutExcluded(places, excluded)]));

        const resolveExchange = exchangeResolver(settings?.portfolioExchanges);

        renderEarnColumn({
            rates: byCoin,
            holdings: counted,
            resolveExchange,
            hidden,
            version: `${version}|${hidden}`
        });

        if (snapshot) {
            renderTotalsBanner({
                byCoin, holdings: snapshot.holdings, resolve: resolveExchange, version: String(version)
            });
        }
    };

    // Star clicked: the worker saves the list and answers with it; show it right away, without the notify round trip.
    function toggleFavorite(symbol: string) {
        const message: FavoriteToggleMessage = { type: FAVORITE_TOGGLE_MESSAGE, symbol };
        chrome.runtime.sendMessage(message)
            .then((favorites: string[] | undefined) => {
                if (settings && Array.isArray(favorites)) {
                    settings = { ...settings, favorites };
                    scheduleUpdate();
                }
            })
            .catch((error) => console.warn('[cmc-helper] Failed to save the To buy list', error));
    }

    // A transaction was added: make CMC reload its current view, and reload our own data.
    function refreshAfterTransaction() {
        invalidateHoldings();
        invalidateTotals();

        // The selected sidebar item (a portfolio) is the one styled differently from its siblings; none = overview.
        const items = [...document.querySelectorAll<HTMLElement>('[data-rbd-draggable-id]')];
        const counts = new Map<string, number>();
        items.forEach((item) => counts.set(item.className, (counts.get(item.className) ?? 0) + 1));
        const selected = items.length > 1 ? items.find((item) => counts.get(item.className) === 1) : undefined;
        const overview = [...document.querySelectorAll<HTMLElement>('div, span, p')].find((el) => (
            el.childElementCount === 0 && el.textContent?.trim() === 'Overview'
            && !el.closest('header, nav, [data-test^="global-header"]')
        ));
        const current = selected?.querySelector<HTMLElement>('.name') ?? overview;
        // CMC ignores a click on the item already selected: step to another one and right back, which refetches.
        const other = selected ? overview : items[0]?.querySelector<HTMLElement>('.name');

        if (current && other) {
            other.click();
            setTimeout(() => {
                current.click();
                scheduleUpdate();
            }, 50);
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

        // The "To buy" list changed (maybe in another tab): reload it with the settings, nothing else.
        if (message?.type === FAVORITES_CHANGED_MESSAGE) {
            invalidatePageSettings();
            scheduleUpdate();
        }
    });

    scheduleUpdate();
}
