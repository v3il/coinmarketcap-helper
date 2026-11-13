import { fetchPortfolios, fetchPortfolioTotals, sumTotals, type PortfolioTotals } from './cmcApi';
import { h } from './dom';
import { TABLE_SELECTOR } from './render';

const BANNER_CLASS = 'cmc-helper-totals';
const CACHE_TTL_MS = 2 * 60 * 1000;
/** After a failed load, wait this long before trying again. */
const RETRY_AFTER_MS = 30 * 1000;

let cache: { at: number; ttl: number; promise: Promise<PortfolioTotals | null> } | null = null;

/** Totals across all portfolios CMC counts in the overall balance (CMC itself shows P/L only per portfolio). */
function loadTotals(): Promise<PortfolioTotals | null> {
    if (cache && Date.now() - cache.at < cache.ttl) {
        return cache.promise;
    }

    const entry = { at: Date.now(), ttl: CACHE_TTL_MS, promise: Promise.resolve<PortfolioTotals | null>(null) };

    entry.promise = (async () => {
        const portfolios = (await fetchPortfolios()).filter((portfolio) => portfolio.counted);
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
    const plPercent = totals.invested > 0 ? (totals.pl / totals.invested) * 100 : 0;
    const percent = `${plPercent > 0 ? '+' : ''}${plPercent.toFixed(2)}%`;

    const stat = (name: string, value: string, extraClass = '') => h(
        'div',
        { class: `${BANNER_CLASS}__stat` },
        h('span', { class: `${BANNER_CLASS}__label` }, name),
        h('span', { class: `${BANNER_CLASS}__value ${extraClass}`.trim() }, value)
    );

    banner.replaceChildren(
        h('div', { class: `${BANNER_CLASS}__title` }, 'All portfolios'),
        stat('Invested', money(totals.invested)),
        stat('Value', money(totals.value)),
        stat('Profit / Loss', hidden ? percent : `${money(totals.pl, true)} (${percent})`, signClass(totals.pl)),
        stat('Realized', money(totals.realized, true), signClass(totals.realized)),
        stat('Unrealized', money(totals.unrealized, true), signClass(totals.unrealized))
    );
    banner.hidden = false;
}

/**
 * Shows invested / value / profit-loss across all portfolios above the portfolio table, on the overview and
 * on every single-portfolio page. Idempotent: only re-renders when CMC's hide-balances mode changes.
 */
export function renderTotalsBanners() {
    document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR).forEach((table) => {
        if (!table.querySelector('tbody tr')) {
            return;
        }

        const anchor = table.closest('.portfolio-tablelist-wrapper') ?? table;
        const previous = anchor.previousElementSibling;
        let banner = previous?.classList.contains(BANNER_CLASS) ? previous as HTMLElement : null;

        if (!banner) {
            banner = h('div', { class: BANNER_CLASS, hidden: '' });
            anchor.before(banner);
        }

        const hidden = (table.textContent ?? '').includes('****');
        const renderKey = String(hidden);

        if (banner.dataset.key === renderKey) {
            return;
        }

        banner.dataset.key = renderKey;
        const target = banner;

        loadTotals().then((totals) => {
            if (target.dataset.key !== renderKey) {
                return;
            }

            if (totals) {
                fill(target, totals, hidden);
                return;
            }

            // Failed: stay hidden, and let a later DOM update retry once the failure cooldown has passed.
            target.hidden = true;
            setTimeout(() => {
                if (target.dataset.key === renderKey) {
                    delete target.dataset.key;
                }
            }, RETRY_AFTER_MS);
        });
    });
}
