import type { Rate } from '@/lib/exchanges';
import { flexibleApr, type ExchangeRates, type RatesByCoin } from '@/lib/rates';
import { h } from './dom';

export const TABLE_SELECTOR = '.portfolio-tablelist-wrapper .cmc-table';
// Overview table uses .symbol-name; per-portfolio table uses .coin-item-symbol.
const OVERVIEW_SYMBOL_SELECTOR = '.symbol-name';
const SYMBOL_SELECTOR = '.symbol-name, .coin-item-symbol';

export type TableView =
    | { kind: 'overview'; key: string }
    | { kind: 'portfolio'; key: string; symbols: string[] };

/** Which view a portfolio table shows: the overview of all portfolios, or one portfolio (by its coins). */
export function getTableView(table: HTMLTableElement): TableView | null {
    const symbols = [...new Set([...table.querySelectorAll(`tbody ${SYMBOL_SELECTOR}`)]
        .map((el) => el.textContent?.trim().toLowerCase())
        .filter((symbol): symbol is string => !!symbol))].sort();

    if (symbols.length === 0) {
        return null;
    }

    return table.querySelector(OVERVIEW_SYMBOL_SELECTOR)
        ? { kind: 'overview', key: 'overview' }
        : { kind: 'portfolio', key: `portfolio:${symbols.join(',')}`, symbols };
}

const COL_CLASS = 'cmc-helper-earn-col';
const HEAD_CLASS = 'cmc-helper-earn-head';
const CELL_CLASS = 'cmc-helper-earn-cell';

type Place = (parent: Element, child: Element) => void;

export const hasPortfolioTable = () => document.querySelector(TABLE_SELECTOR) !== null;

/** Lower-case symbols of all coins currently shown in portfolio tables. */
export function getPortfolioTableSymbols(): string[] {
    const symbols = new Set<string>();

    document.querySelectorAll(`${TABLE_SELECTOR} tbody ${SYMBOL_SELECTOR}`).forEach((el) => {
        const symbol = el.textContent?.trim().toLowerCase();

        if (symbol) {
            symbols.add(symbol);
        }
    });

    return [...symbols].sort();
}

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
    // Separately, highlight the best fixed-term rate(s) across exchanges.
    const bestFixed = Math.max(0, ...exchangeRates.flatMap(({ rates }) => rates)
        .filter((rate) => rate.days > 0)
        .map((rate) => rate.apr));

    return h(
        'td',
        { class: CELL_CLASS, 'data-symbol': symbol },
        ...exchangeRates.map(({ exchange, rates }) => h(
            'div',
            { class: isBest(rates) ? 'cmc-helper-earn cmc-helper-earn--max' : 'cmc-helper-earn', title: exchange.name },
            h('div', { class: 'cmc-helper-earn__content' }, ...rates.map((rate) => createTip(rate, bestFixed))),
            h('img', { src: exchange.logoUrl, alt: exchange.name })
        ))
    );
}

function createTip({ apr, days }: Rate, bestFixed: number) {
    const flexible = days === 0;
    const classes = ['cmc-helper-earn__tip'];

    if (flexible) {
        classes.push('cmc-helper-earn__tip--infinite');
    } else if (apr === bestFixed) {
        classes.push('cmc-helper-earn__tip--best-fixed');
    }

    return h('span', { class: classes.join(' ') }, `${flexible ? '∞' : `${days}d`}: ${apr.toFixed(2)}%`);
}
