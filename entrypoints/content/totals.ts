import {
    PAGE_SETTINGS_MESSAGE, PORTFOLIO_NAMES_MESSAGE, type PageSettings, type PortfolioNamesMessage
} from '@/lib/messages';
import { fetchPortfolios, fetchPortfolioTotals, sumTotals, type PortfolioTotals } from './cmcApi';
import { h } from './dom';
import { TABLE_SELECTOR } from './render';

const BANNER_CLASS = 'cmc-helper-totals';
const CACHE_TTL_MS = 2 * 60 * 1000;
/** After a failed load, wait this long before trying again. */
const RETRY_AFTER_MS = 30 * 1000;
let cache: { at: number; ttl: number; promise: Promise<PortfolioTotals | null> } | null = null;

/** Lower-case names of portfolios the user excluded from the totals in the extension settings. */
async function getExcludedPortfolios(): Promise<Set<string>> {
    const response: PageSettings | undefined = await chrome.runtime.sendMessage({ type: PAGE_SETTINGS_MESSAGE });
    return new Set((response?.excludedPortfolios ?? []).map((name) => name.trim().toLowerCase()));
}

/** Forget loaded totals and re-render the banner on the next update (e.g. after the settings changed). */
export function invalidateTotals() {
    cache = null;
    const banner = document.querySelector<HTMLElement>(`.${BANNER_CLASS}`);

    if (banner) {
        delete banner.dataset.key;
    }
}

/**
 * Totals across the portfolios CMC counts in the overall balance, minus the ones excluded in the settings
 * (CMC itself shows P/L only per portfolio).
 */
function loadTotals(): Promise<PortfolioTotals | null> {
    if (cache && Date.now() - cache.at < cache.ttl) {
        return cache.promise;
    }

    const entry = { at: Date.now(), ttl: CACHE_TTL_MS, promise: Promise.resolve<PortfolioTotals | null>(null) };

    entry.promise = (async () => {
        const [all, excluded] = await Promise.all([fetchPortfolios(), getExcludedPortfolios()]);
        // Let the settings page offer these portfolios as checkboxes (names only).
        const names: PortfolioNamesMessage = { type: PORTFOLIO_NAMES_MESSAGE, names: all.map((p) => p.name) };
        chrome.runtime.sendMessage(names).catch(() => {});

        const portfolios = all.filter((portfolio) => portfolio.counted
            && !excluded.has(portfolio.name.trim().toLowerCase()));
        return sumTotals(await Promise.all(portfolios.map((portfolio) => fetchPortfolioTotals(portfolio.id))));
    })().catch((error) => {
        console.warn('[cmc-helper] Failed to load portfolio totals', error);
        entry.ttl = RETRY_AFTER_MS;
        return null;
    });

    cache = entry;
    return entry.promise;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const signClass = (value: number) => {
    if (value > 0) return `${BANNER_CLASS}__value--up`;
    if (value < 0) return `${BANNER_CLASS}__value--down`;
    return '';
};

function fill(banner: HTMLElement, totals: PortfolioTotals, hidden: boolean) {
    // When CMC hides balances (****), hide amounts too and keep only the percentage.
    const money = (value: number, signed = false) => {
        if (hidden) return '*****';
        return `${signed && value > 0 ? '+' : ''}${usd.format(value)}`;
    };
    // CMC's "cost basis" is the sum of all buys, so every swap (sell A, buy B) counts the same money again and
    // cost basis + P/L != value. Net invested is what was actually put in: value - P/L.
    const netInvested = totals.value - totals.pl;
    const plPercent = netInvested > 0 ? (totals.pl / netInvested) * 100 : 0;
    const percent = `${plPercent > 0 ? '+' : ''}${plPercent.toFixed(2)}%`;

    const stat = (name: string, value: string, extraClass = '', title = '') => h(
        'div',
        { class: `${BANNER_CLASS}__stat`, ...(title ? { title } : {}) },
        h('span', { class: `${BANNER_CLASS}__label` }, name),
        h('span', { class: `${BANNER_CLASS}__value ${extraClass}`.trim() }, value)
    );

    banner.replaceChildren(
        stat(
            'Invested',
            money(netInvested),
            '',
            `Net invested = value − profit/loss.\nTotal buys in CoinMarketCap: ${money(totals.invested)} `
                + '(counts money reinvested through swaps again).'
        ),
        stat('Value', money(totals.value)),
        stat('Profit / Loss', hidden ? percent : `${money(totals.pl, true)} (${percent})`, signClass(totals.pl))
    );
    banner.hidden = false;
}

/**
 * The element to put the banner in front of: the top of the portfolio content (above "Total value"), or CMC's
 * charts header, or the table itself — whichever the current layout allows.
 */
function findAnchor(table: HTMLTableElement): Element {
    const tableWrapper = table.closest('.portfolio-tablelist-wrapper') ?? table;

    // Preferred: the very top of the portfolio box, above CMC's "Total value" header.
    const chartBox = tableWrapper.closest('[class*="StyledChartBox"]');

    if (chartBox?.firstElementChild && !chartBox.firstElementChild.contains(tableWrapper)) {
        return chartBox.firstElementChild;
    }

    // Otherwise: above CMC's charts, which share a container with the table.
    for (let el = tableWrapper.parentElement; el && el !== document.body; el = el.parentElement) {
        const header = [...el.children].find((child) => !child.contains(tableWrapper)
            && (child.matches('[class*="header-wrapper"]') || child.querySelector('[class*="header-wrapper"]')));

        if (header) {
            return header;
        }
    }

    return tableWrapper;
}

/**
 * Shows invested / value / profit-loss across all portfolios at the top of the portfolio page, on the overview
 * and on every single-portfolio page. Idempotent: only re-renders when CMC's hide-balances mode changes.
 */
export function renderTotalsBanner() {
    const table = document.querySelector<HTMLTableElement>(TABLE_SELECTOR);

    if (!table?.querySelector('tbody tr')) {
        return;
    }

    const anchor = findAnchor(table);
    const banner = document.querySelector<HTMLElement>(`.${BANNER_CLASS}`)
        ?? h('div', { class: BANNER_CLASS, hidden: '' });

    // (Re)place it: CMC may re-render the page around it.
    if (anchor.previousElementSibling !== banner) {
        anchor.before(banner);
    }

    const hidden = (table.textContent ?? '').includes('****');
    const renderKey = String(hidden);

    if (banner.dataset.key === renderKey) {
        return;
    }

    banner.dataset.key = renderKey;

    loadTotals().then((totals) => {
        if (banner.dataset.key !== renderKey) {
            return;
        }

        if (totals) {
            fill(banner, totals, hidden);
            return;
        }

        // Failed: stay hidden, and let a later DOM update retry once the failure cooldown has passed.
        banner.hidden = true;
        setTimeout(() => {
            if (banner.dataset.key === renderKey) {
                delete banner.dataset.key;
            }
        }, RETRY_AFTER_MS);
    });
}
