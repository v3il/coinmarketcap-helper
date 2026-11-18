import { h } from './dom';
import { TABLE_SELECTOR } from './render';

// The "To buy" list: a ☆/★ before each coin's logo marks the coins the owner would like to buy more of; marked rows
// are highlighted, and "★ To buy (N)" above the table hides the rest. Renders are idempotent (the update loop re-runs
// on every DOM change).

const WRAPPER_SELECTOR = '.portfolio-tablelist-wrapper';
const SYMBOL_SELECTOR = '.symbol-name, .coin-item-symbol';
const STAR_CLASS = 'cmc-helper-star';
const ROW_CLASS = 'cmc-helper-to-buy';
const FILTER_CLASS = 'cmc-helper-buy-filter';
const BAR_CLASS = 'cmc-helper-buy-bar';

export interface BuyListOptions {
    /** Lower-case symbols. */
    favorites: Set<string>;
    onToggle: (symbol: string) => void;
}

/** The user's choice to show only marked coins; kept while the tab is open (also across portfolios). */
let filterOn = false;

/** A table with nothing marked (or still loading) shows everything, but the choice stays for the next table. */
export const filterApplied = (on: boolean, count: number) => on && count > 0;

const stopEvents = (el: HTMLElement) => ['mousedown', 'pointerdown'].forEach((type) => {
    el.addEventListener(type, (event) => event.stopPropagation());
});

/** The star goes first in the coin's cell: before its logo, or before the name block when there's no logo. */
function starAnchor(symbolEl: Element): Element | null {
    const cell = symbolEl.closest('td');
    return cell?.querySelector(`img:not(.${STAR_CLASS})`) ?? symbolEl.parentElement;
}

function renderStar(symbolEl: Element, symbol: string, marked: boolean, onToggle: BuyListOptions['onToggle']) {
    const key = `${symbol}|${marked}`;
    const anchor = starAnchor(symbolEl);
    const existing = symbolEl.closest('td')?.querySelector<HTMLButtonElement>(`.${STAR_CLASS}`);

    if (!anchor) {
        return;
    }

    // Already in place and up to date (CMC may re-render the cell and drop our star: then it's rebuilt).
    if (existing?.dataset.key === key && existing.nextElementSibling === anchor) {
        return;
    }

    if (existing?.dataset.key === key) {
        return;
    }

    existing?.remove();
    const ticker = symbol.toUpperCase();
    const star = h(
        'button',
        {
            type: 'button',
            class: STAR_CLASS,
            title: marked ? `Remove ${ticker} from the To buy list` : `Add ${ticker} to the To buy list`,
            'aria-label': `${ticker}: to buy`,
            'aria-pressed': String(marked)
        },
        marked ? '★' : '☆'
    );
    star.dataset.key = key;
    star.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle(symbol);
    });
    stopEvents(star);
    anchor.before(star);
}

function renderBar(table: HTMLElement, count: number) {
    const wrapper = table.closest(WRAPPER_SELECTOR);

    if (!wrapper) {
        return;
    }

    let bar = wrapper.previousElementSibling?.classList.contains(BAR_CLASS)
        ? wrapper.previousElementSibling as HTMLElement
        : null;

    if (!bar) {
        const button = h('button', { type: 'button', class: `${BAR_CLASS}__button` });
        button.addEventListener('click', () => {
            filterOn = !filterOn;
            // Apply right away (CMC may have replaced the table since the bar was made: look it up again).
            const current = document.querySelector<HTMLElement>(TABLE_SELECTOR);
            current?.classList.toggle(FILTER_CLASS, filterApplied(filterOn, Number(button.dataset.count)));

            if (current) {
                renderBar(current, Number(button.dataset.count));
            }
        });
        bar = h('div', { class: BAR_CLASS }, button);
        wrapper.before(bar);
    }

    const button = bar.querySelector<HTMLButtonElement>('button')!;
    const text = `★ To buy (${count})`;
    const applied = filterApplied(filterOn, count);
    const state = `${count}|${applied}`;

    if (button.dataset.state === state) {
        return;
    }

    button.dataset.state = state;
    button.dataset.count = String(count);
    button.textContent = text;
    button.disabled = count === 0;
    button.setAttribute('aria-pressed', String(applied));
    button.title = applied ? 'Show all coins' : 'Show only the coins marked to buy';
}

export function renderBuyList({ favorites, onToggle }: BuyListOptions) {
    const table = document.querySelector<HTMLElement>(TABLE_SELECTOR);

    if (!table) {
        return;
    }

    let count = 0;

    table.querySelectorAll('tbody tr').forEach((row) => {
        const symbolEl = row.querySelector(SYMBOL_SELECTOR);
        const symbol = symbolEl?.textContent?.trim().toLowerCase();

        if (!symbolEl || !symbol) {
            return;
        }

        const marked = favorites.has(symbol);
        count += marked ? 1 : 0;
        renderStar(symbolEl, symbol, marked, onToggle);

        if (row.classList.contains(ROW_CLASS) !== marked) {
            row.classList.toggle(ROW_CLASS, marked);
        }
    });

    const applied = filterApplied(filterOn, count);

    if (table.classList.contains(FILTER_CLASS) !== applied) {
        table.classList.toggle(FILTER_CLASS, applied);
    }

    renderBar(table, count);
}
