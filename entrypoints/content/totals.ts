import type { ExchangeResolver, HoldingsByCoin } from '@/lib/holdings';
import { formatIncomeStat, formatMovesTip, portfolioIncome } from '@/lib/income';
import { PORTFOLIO_NAMES_MESSAGE, type PortfolioNamesMessage } from '@/lib/messages';
import type { RatesByCoin } from '@/lib/rates';
import { fetchPortfolios, fetchPortfolioTotals, sumTotals, type PortfolioTotals } from './cmcApi';
import { h } from './dom';
import { loadPageSettings } from './pageSettings';
import { TABLE_SELECTOR } from './render';

const BANNER_CLASS = 'cmc-helper-totals';
const CACHE_TTL_MS = 2 * 60 * 1000;
/** After a failed load, wait this long before trying again. */
const RETRY_AFTER_MS = 30 * 1000;
/** Totals of the portfolios the banner counts, and their names (the income stat counts the same ones). */
interface BannerTotals extends PortfolioTotals {
    portfolios: Set<string>;
}

/** What the yearly-income stat needs; until rates arrive the stat shows "…". */
export interface IncomeInput {
    byCoin: RatesByCoin;
    holdings: HoldingsByCoin;
    resolve: ExchangeResolver;
    /** Changes whenever rates or holdings do, so the banner re-renders. */
    version: string;
}

let cache: { at: number; ttl: number; promise: Promise<BannerTotals | null> } | null = null;
/** The latest income input, reused by the calls made before rates are ready (no flicker back to "…"). */
let lastIncome: IncomeInput | undefined;

/** Lower-case names of portfolios the user excluded from the totals in the extension settings. */
async function getExcludedPortfolios(): Promise<Set<string>> {
    const { excludedPortfolios } = await loadPageSettings();
    return new Set(excludedPortfolios.map((name) => name.trim().toLowerCase()));
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
function loadTotals(): Promise<BannerTotals | null> {
    if (cache && Date.now() - cache.at < cache.ttl) {
        return cache.promise;
    }

    const entry = { at: Date.now(), ttl: CACHE_TTL_MS, promise: Promise.resolve<BannerTotals | null>(null) };

    entry.promise = (async () => {
        const [all, excluded] = await Promise.all([fetchPortfolios(), getExcludedPortfolios()]);
        // Let the settings page offer these portfolios as checkboxes (names only).
        const names: PortfolioNamesMessage = { type: PORTFOLIO_NAMES_MESSAGE, names: all.map((p) => p.name) };
        chrome.runtime.sendMessage(names).catch(() => {});

        const portfolios = all.filter((portfolio) => portfolio.counted
            && !excluded.has(portfolio.name.trim().toLowerCase()));
        const totals = sumTotals(await Promise.all(portfolios.map((portfolio) => fetchPortfolioTotals(portfolio.id))));
        return { ...totals, portfolios: new Set(portfolios.map(({ name }) => name)) };
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

function incomeStat(totals: BannerTotals, income: IncomeInput | undefined, hidden: boolean) {
    if (!income) {
        return { main: '…', percent: '', title: 'Loading rates…' };
    }

    const holdings = Object.fromEntries(income.holdings);
    const result = portfolioIncome(holdings, income.byCoin, income.resolve, (name) => totals.portfolios.has(name));
    return {
        ...formatIncomeStat(result, hidden),
        title: `A year at the current rates → with every coin at its best rate.\n${formatMovesTip(result.moves)}`
    };
}

function fill(banner: HTMLElement, totals: BannerTotals, hidden: boolean, income: IncomeInput | undefined) {
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

    // No rates at all (the worker failed): leave the income stat out rather than show 0%.
    if (!income || income.byCoin.size > 0) {
        const earn = incomeStat(totals, income, hidden);
        banner.append(h(
            'div',
            { class: `${BANNER_CLASS}__stat`, title: earn.title },
            h('span', { class: `${BANNER_CLASS}__label` }, 'Earn / yr'),
            h('span', { class: `${BANNER_CLASS}__value` }, earn.main),
            ...(earn.percent ? [h('span', { class: `${BANNER_CLASS}__sub` }, earn.percent)] : [])
        ));
    }
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
export function renderTotalsBanner(next?: IncomeInput) {
    lastIncome = next ?? lastIncome;
    const income = lastIncome;
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
    const renderKey = `${hidden}|${income?.version ?? ''}`;

    if (banner.dataset.key === renderKey) {
        return;
    }

    banner.dataset.key = renderKey;

    loadTotals().then((totals) => {
        if (banner.dataset.key !== renderKey) {
            return;
        }

        if (totals) {
            fill(banner, totals, hidden, income);
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
