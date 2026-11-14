import type { Rate } from '@/lib/exchanges';
import {
    estimateIncome, formatCoins, type ExchangeResolver, type Holding, type HoldingsByCoin, type IncomeRate
} from '@/lib/holdings';
import { flexibleApr, type ExchangeRates, type RatesByCoin } from '@/lib/rates';
import { h } from './dom';

export const TABLE_SELECTOR = '.portfolio-tablelist-wrapper .cmc-table';
// Overview table uses .symbol-name; per-portfolio table uses .coin-item-symbol.
const OVERVIEW_SYMBOL_SELECTOR = '.symbol-name';
const SYMBOL_SELECTOR = '.symbol-name, .coin-item-symbol';

const COL_CLASS = 'cmc-helper-earn-col';
const HEAD_CLASS = 'cmc-helper-earn-head';
const CELL_CLASS = 'cmc-helper-earn-cell';

type Place = (parent: Element, child: Element) => void;

export interface EarnContext {
    rates: RatesByCoin;
    /** Where each coin is held; null until loaded (or if CMC's API isn't available). */
    holdings: HoldingsByCoin | null;
    resolveExchange: ExchangeResolver;
    /** CMC hides balances: show percentages instead of dollar amounts. */
    hidden: boolean;
    /** Changes whenever holdings or settings change, so existing cells re-render. */
    version: string;
}

export const hasPortfolioTable = () => document.querySelector(TABLE_SELECTOR) !== null;

/** CMC replaces amounts with asterisks when the user hides balances. */
export const areBalancesHidden = () => (document.querySelector(TABLE_SELECTOR)?.textContent ?? '').includes('****');

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
 * on every DOM mutation — it only touches rows that are new, whose coin changed, or when the context changed.
 */
export function renderEarnColumn(context: EarnContext) {
    document.querySelectorAll<HTMLTableElement>(TABLE_SELECTOR).forEach((table) => renderTable(table, context));
}

function renderTable(table: HTMLTableElement, context: EarnContext) {
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

    table.querySelectorAll('tbody tr').forEach((row) => renderRow(row, context, place));
}

function renderRow(row: Element, context: EarnContext, place: Place) {
    const symbol = row.querySelector(SYMBOL_SELECTOR)?.textContent?.trim().toLowerCase();

    if (!symbol) {
        return;
    }

    const existing = row.querySelector<HTMLTableCellElement>(`:scope > .${CELL_CLASS}`);
    // The page may reuse a row for a different coin, so compare against what was rendered.
    const key = `${symbol}|${context.version}`;

    if (existing?.dataset.key === key) {
        return;
    }

    const cell = createCell(symbol, context);
    cell.dataset.key = key;

    if (existing) {
        existing.replaceWith(cell);
    } else {
        place(row, cell);
    }
}

const usd = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 10 ? 2 : 0
}).format(value);

const term = (days: number) => (days === 0 ? '∞' : `${days}d`);

function createCell(symbol: string, context: EarnContext) {
    const exchangeRates = context.rates.get(symbol) ?? [];
    const holdings = context.holdings?.get(symbol) ?? [];
    const heldOn = new Set(holdings.map((holding) => context.resolveExchange(holding.portfolio)?.id).filter(Boolean));

    // Highlight the exchange(s) with the best flexible rate; fixed terms aren't comparable.
    const bestFlexible = Math.max(0, ...exchangeRates.map(({ rates }) => flexibleApr(rates)));
    const isBest = (rates: Rate[]) => bestFlexible > 0 && flexibleApr(rates) === bestFlexible;
    // Separately, highlight the best fixed-term rate(s) across exchanges.
    const bestFixed = Math.max(0, ...exchangeRates.flatMap(({ rates }) => rates)
        .filter((rate) => rate.days > 0)
        .map((rate) => rate.apr));

    const rows = exchangeRates.map(({ exchange, rates }) => {
        const held = heldOn.has(exchange.id);
        const classes = ['cmc-helper-earn'];

        if (isBest(rates)) classes.push('cmc-helper-earn--max');
        if (held) classes.push('cmc-helper-earn--held');

        return h(
            'div',
            { class: classes.join(' '), title: held ? `${exchange.name} — you hold it here` : exchange.name },
            h('div', { class: 'cmc-helper-earn__content' }, ...rates.map((rate) => createTip(rate, bestFixed))),
            h('img', { src: exchange.logoUrl, alt: exchange.name })
        );
    });

    return h(
        'td',
        { class: CELL_CLASS, 'data-symbol': symbol },
        ...rows,
        createIncome(symbol, holdings, exchangeRates, context)
    );
}

/** "≈ $12/yr → $141/yr": yearly income now vs. at the best realistic rate. */
function createIncome(symbol: string, holdings: Holding[], exchangeRates: ExchangeRates[], context: EarnContext) {
    if (holdings.length === 0) {
        return null;
    }

    const income = estimateIncome(holdings, exchangeRates, context.resolveExchange);

    if (income.value <= 0 || (income.now === 0 && !income.bestRate)) {
        return null;
    }

    const nowPercent = (income.now / income.value) * 100;
    const bestPercent = (income.best / income.value) * 100;
    const better = income.best - income.now >= 0.5 && bestPercent - nowPercent >= 0.1;
    const describe = (rate: IncomeRate | null) => (
        rate ? `${rate.exchange.name} ${term(rate.days)} ${rate.apr.toFixed(2)}%` : ''
    );

    // Coins per year (that's what lands in the wallet); USD only if the amounts aren't known.
    const ticker = symbol.toUpperCase();
    const amount = (coins: number | null, usdValue: number) => (
        coins === null ? `${usd(usdValue)}/yr` : `${formatCoins(coins)} ${ticker}/yr`
    );

    const text = context.hidden
        ? `≈ ${nowPercent.toFixed(2)}%${better ? ` → ${bestPercent.toFixed(2)}%` : ''} a year`
        : `≈ ${amount(income.nowCoins, income.now)}${better ? ` → ${amount(income.bestCoins, income.best)}` : ''}`;

    return h(
        'div',
        {
            class: better ? 'cmc-helper-earn__income cmc-helper-earn__income--better' : 'cmc-helper-earn__income',
            title: 'Now: the best rate where the coin is held (0% in wallets and without an earn product).'
                + `${better ? `\nBest: ${describe(income.bestRate)} (fixed terms under 7 days are ignored).` : ''}`
        },
        text
    );
}

function createTip({ apr, days, unbondingDays }: Rate, bestFixed: number) {
    const flexible = days === 0;
    const classes = ['cmc-helper-earn__tip'];

    if (flexible) {
        classes.push('cmc-helper-earn__tip--infinite');
    } else if (apr === bestFixed) {
        classes.push('cmc-helper-earn__tip--best-fixed');
    }

    const title = unbondingDays ? `No lock-up; withdrawal takes ${unbondingDays} days after unstaking` : '';

    return h(
        'span',
        { class: classes.join(' '), ...(title ? { title } : {}) },
        `${term(days)}: ${apr.toFixed(2)}%`
    );
}
