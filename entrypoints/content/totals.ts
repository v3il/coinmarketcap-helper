import {
    fetchPortfolioCoins, fetchPortfolios, fetchPortfolioTotals, sumTotals, type PortfolioTotals
} from './cmcApi';
import { h } from './dom';
import { getTableView, TABLE_SELECTOR, type TableView } from './render';

const BANNER_CLASS = 'cmc-helper-totals';
const CACHE_TTL_MS = 2 * 60 * 1000;
/** A portfolio table matches a CMC portfolio if their coin sets overlap at least this much (Jaccard). */
const MIN_MATCH = 0.6;

interface Loaded {
    label: string;
    totals: PortfolioTotals;
}

const cache = new Map<string, { at: number; promise: Promise<Loaded | null> }>();

async function loadOverview(): Promise<Loaded> {
    const portfolios = (await fetchPortfolios()).filter((portfolio) => portfolio.counted);
    const totals = await Promise.all(portfolios.map((portfolio) => fetchPortfolioTotals(portfolio.id)));

    return { label: 'All portfolios', totals: sumTotals(totals) };
}

/**
 * The portfolio table doesn't say which portfolio it shows, so find the CMC portfolio whose coins match
 * the table's coins. Coins sold to zero may be in the table but not in CMC's holdings, hence the fuzzy match.
 */
async function loadPortfolio(symbols: string[]): Promise<Loaded | null> {
    const [portfolios, coins] = await Promise.all([fetchPortfolios(), fetchPortfolioCoins()]);
    const shown = new Set(symbols);

    const scored = portfolios.map((portfolio) => {
        const held = coins.get(portfolio.id) ?? new Set<string>();
        const common = [...shown].filter((symbol) => held.has(symbol)).length;
        return { portfolio, score: common / new Set([...shown, ...held]).size };
    }).sort((a, b) => b.score - a.score);

    const [best, second] = scored;

    // Not confident (e.g. two portfolios holding the same coins): show nothing rather than a wrong total.
    if (!best || best.score < MIN_MATCH || (second && second.score === best.score)) {
        return null;
    }

    return { label: best.portfolio.name, totals: await fetchPortfolioTotals(best.portfolio.id) };
}

function load(view: TableView): Promise<Loaded | null> {
    const hit = cache.get(view.key);

    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return hit.promise;
    }

    const promise = (view.kind === 'overview' ? loadOverview() : loadPortfolio(view.symbols)).catch((error) => {
        console.warn('[cmc-helper] Failed to load portfolio totals', error);
        return null;
    });

    cache.set(view.key, { at: Date.now(), promise });
    return promise;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const signClass = (value: number) => {
    if (value > 0) return `${BANNER_CLASS}__value--up`;
    if (value < 0) return `${BANNER_CLASS}__value--down`;
    return '';
};

function fill(banner: HTMLElement, { label, totals }: Loaded, hidden: boolean) {
    // When CMC hides balances (****), hide amounts too and keep only the percentage.
    const money = (value: number, signed = false) => {
        if (hidden) return '*****';
        return `${signed && value > 0 ? '+' : ''}${usd.format(value)}`;
    };
    const plPercent = totals.invested > 0 ? (totals.pl / totals.invested) * 100 : 0;
    const percent = `${plPercent > 0 ? '+' : ''}${plPercent.toFixed(2)}%`;

    const stat = (name: string, value: string, extraClass = '') => h(
        'div',
        { class: `${BANNER_CLASS}__stat` },
        h('span', { class: `${BANNER_CLASS}__label` }, name),
        h('span', { class: `${BANNER_CLASS}__value ${extraClass}`.trim() }, value)
    );

    banner.replaceChildren(
        h('div', { class: `${BANNER_CLASS}__title` }, label),
        stat('Invested', money(totals.invested)),
        stat('Value', money(totals.value)),
        stat('Profit / Loss', hidden ? percent : `${money(totals.pl, true)} (${percent})`, signClass(totals.pl)),
        stat('Realized', money(totals.realized, true), signClass(totals.realized)),
        stat('Unrealized', money(totals.unrealized, true), signClass(totals.unrealized))
    );
    banner.hidden = false;
}

/**
 * Shows invested / value / profit-loss above every portfolio table, for the overview or the shown portfolio.
 * Idempotent: only re-renders when the table's view (or CMC's hide-balances mode) changes.
 */
export function renderTotalsBanners() {
    document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR).forEach((table) => {
        const view = getTableView(table);
        const anchor = table.closest('.portfolio-tablelist-wrapper') ?? table;

        if (!view) {
            return;
        }

        const previous = anchor.previousElementSibling;
        let banner = previous?.classList.contains(BANNER_CLASS) ? previous as HTMLElement : null;

        if (!banner) {
            banner = h('div', { class: BANNER_CLASS, hidden: '' });
            anchor.before(banner);
        }

        const hidden = (table.textContent ?? '').includes('****');
        const renderKey = `${view.key}|${hidden}`;

        if (banner.dataset.key === renderKey) {
            return;
        }

        banner.dataset.key = renderKey;
        const target = banner;

        load(view).then((loaded) => {
            // The table may have switched to another view meanwhile.
            if (target.dataset.key !== renderKey) {
                return;
            }

            if (loaded) {
                fill(target, loaded, hidden);
            } else {
                target.hidden = true;
            }
        });
    });
}
