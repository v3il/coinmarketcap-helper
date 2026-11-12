import { h } from './dom';
import type { Rate } from './exchanges';
import { flexibleApr, type ExchangeRates, type RatesByCoin } from './rates';

const TABLE_SELECTOR = '.portfolio-tablelist-wrapper .cmc-table';
// Overview table uses .symbol-name; per-portfolio table uses .coin-item-symbol.
const OVERVIEW_SYMBOL_SELECTOR = '.symbol-name';
const SYMBOL_SELECTOR = '.symbol-name, .coin-item-symbol';

const COL_CLASS = 'cmc-helper-earn-col';
const HEAD_CLASS = 'cmc-helper-earn-head';
const CELL_CLASS = 'cmc-helper-earn-cell';

type Place = (parent: Element, child: Element) => void;

export const hasPortfolioTable = () => document.querySelector(TABLE_SELECTOR) !== null;

/**
 * Adds the Earn column to every portfolio table on the page. Idempotent: safe to call
 * on every DOM mutation — it only touches rows that are new or whose coin changed.
 */
export function renderEarnColumn(rates: RatesByCoin) {
    document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR).forEach((table) => renderTable(table, rates));
}

function renderTable(table: HTMLTableElement, rates: RatesByCoin) {
    // Wait for rows: the column position depends on which table variant this is.
    if (!table.querySelector(`tbody ${SYMBOL_SELECTOR}`)) {
        return;
    }

    // The overview table gets the column at the end; the others keep their last (actions) column last.
    const place: Place = table.querySelector(OVERVIEW_SYMBOL_SELECTOR)
        ? (parent, child) => parent.append(child)
        : (parent, child) => (parent.lastElementChild ? parent.lastElementChild.before(child) : parent.append(child));

    const colgroup = table.querySelector('colgroup');

    if (colgroup && !colgroup.querySelector(`:scope > .${COL_CLASS}`)) {
        place(colgroup, h('col', { class: COL_CLASS }));
    }

    const headRow = table.querySelector('thead tr');

    if (headRow && !headRow.querySelector(`:scope > .${HEAD_CLASS}`)) {
        place(headRow, h('th', { class: HEAD_CLASS, style: 'text-align: right' }, 'Earn'));
    }

    table.querySelectorAll('tbody tr').forEach((row) => renderRow(row, rates, place));
}

function renderRow(row: Element, rates: RatesByCoin, place: Place) {
    const symbol = row.querySelector(SYMBOL_SELECTOR)?.textContent?.trim().toLowerCase();

    if (!symbol) {
        return;
    }

    const existing = row.querySelector<HTMLTableCellElement>(`:scope > .${CELL_CLASS}`);

    // The page may reuse a row for a different coin, so compare against the rendered symbol.
    if (existing?.dataset.symbol === symbol) {
        return;
    }

    const cell = createCell(symbol, rates.get(symbol) ?? []);

    if (existing) {
        existing.replaceWith(cell);
    } else {
        place(row, cell);
    }
}

function createCell(symbol: string, exchangeRates: ExchangeRates[]) {
    // Highlight the exchange(s) with the best flexible rate; fixed terms aren't comparable.
    const bestFlexible = Math.max(0, ...exchangeRates.map(({ rates }) => flexibleApr(rates)));
    const isBest = (rates: Rate[]) => bestFlexible > 0 && flexibleApr(rates) === bestFlexible;

    return h(
        'td',
        { class: CELL_CLASS, 'data-symbol': symbol },
        ...exchangeRates.map(({ exchange, rates }) => h(
            'div',
            { class: isBest(rates) ? 'cmc-helper-earn cmc-helper-earn--max' : 'cmc-helper-earn', title: exchange.name },
            h('div', { class: 'cmc-helper-earn__content' }, ...rates.map(createTip)),
            h('img', { src: exchange.logoUrl, alt: exchange.name })
        ))
    );
}

function createTip({ apr, days }: Rate) {
    const flexible = days === 0;

    return h(
        'span',
        { class: flexible ? 'cmc-helper-earn__tip cmc-helper-earn__tip--infinite' : 'cmc-helper-earn__tip' },
        `${flexible ? '∞' : `${days}d`}: ${apr.toFixed(2)}%`
    );
}
