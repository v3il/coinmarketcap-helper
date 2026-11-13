import { addTransaction, type PortfolioSnapshot } from './cmcApi';
import { h } from './dom';
import { TABLE_SELECTOR } from './render';

// "Set amount": the user types the coin amount they actually have (e.g. after staking rewards) and the extension
// adds a buy/sell transaction for the difference at the current price. On a single-portfolio table it edits that
// portfolio; on the overview, where a coin may sit in several portfolios, the user picks which one.

const PORTFOLIO_SYMBOL_SELECTOR = '.coin-item-symbol';
const OVERVIEW_SYMBOL_SELECTOR = '.symbol-name';
const CELL_CLASS = 'cmc-helper-editable';
const BUTTON_CLASS = 'cmc-helper-edit';
const EDITOR_CLASS = 'cmc-helper-editor';
/** A table matches a CMC portfolio if their coin sets overlap at least this much (Jaccard). */
const MIN_MATCH = 0.6;

export interface AmountEditorContext {
    snapshot: PortfolioSnapshot;
    /** CMC hides balances: don't prefill the current amount. */
    hidden: boolean;
    /** Called after a transaction was added, to reload the current view. */
    onAdded: () => void;
}

interface Portfolio {
    id: string;
    name: string;
}

/** A coin's position in one portfolio, as offered in the editor. */
interface Place extends Portfolio {
    balance: number;
}

/**
 * The single-portfolio table doesn't say which portfolio it shows: find the CMC portfolio whose coins match the
 * table's coins. Returns null when unsure (e.g. two portfolios with the same coins) — then no editing is offered.
 */
function identifyPortfolio(symbols: string[], snapshot: PortfolioSnapshot): Portfolio | null {
    const portfolios = new Map<string, { name: string; coins: Set<string> }>();

    snapshot.holdings.forEach((places, symbol) => places.forEach((place) => {
        if (!place.portfolioId) return;
        const entry = portfolios.get(place.portfolioId) ?? { name: place.portfolio, coins: new Set<string>() };
        entry.coins.add(symbol);
        portfolios.set(place.portfolioId, entry);
    }));

    const shown = new Set(symbols);
    const scored = [...portfolios].map(([id, { name, coins }]) => {
        const common = [...shown].filter((symbol) => coins.has(symbol)).length;
        return { id, name, score: common / new Set([...shown, ...coins]).size };
    }).sort((a, b) => b.score - a.score);

    const [best, second] = scored;

    if (!best || best.score < MIN_MATCH || (second && second.score === best.score)) {
        return null;
    }

    return { id: best.id, name: best.name };
}

/** The overview's Balance cell, found by its column header. */
function findBalanceCell(table: HTMLTableElement, row: Element): HTMLTableCellElement | null {
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim().toLowerCase());
    const index = headers.indexOf('balance');
    return index >= 0 ? row.querySelectorAll<HTMLTableCellElement>(':scope > td')[index] ?? null : null;
}

/** The Holdings cell: the one with a "<amount> <SYMBOL>" line. */
function findHoldingsCell(row: Element, symbol: string): HTMLTableCellElement | null {
    const pattern = new RegExp(`^[\\d*][\\d.,*\\s]*\\s${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    return [...row.querySelectorAll<HTMLTableCellElement>(':scope > td')]
        .find((td) => (td.innerText || '').split('\n').some((line) => pattern.test(line.trim()))) ?? null;
}

/** 0.1 + 0.2 → "0.3": up to 10 decimals, no float noise, no trailing zeros. */
const formatAmount = (value: number) => value.toFixed(10).replace(/\.?0+$/, '');

const formatPrice = (value: number) => (value >= 1 ? value.toFixed(2) : value.toPrecision(4));

function closeEditors() {
    document.querySelectorAll(`.${EDITOR_CLASS}`).forEach((editor) => editor.remove());
}

/** Places (portfolio + exact amount) where a coin is held, from CMC's dashboard summary. */
function placesOf(symbol: string, snapshot: PortfolioSnapshot): Place[] {
    return (snapshot.holdings.get(symbol) ?? [])
        .filter((holding) => holding.portfolioId)
        .map((holding) => ({ id: holding.portfolioId!, name: holding.portfolio, balance: holding.balance ?? 0 }));
}

function openEditor(cell: HTMLElement, symbol: string, places: Place[], context: AmountEditorContext) {
    closeEditors();

    const coin = context.snapshot.coins.get(symbol);
    const ticker = symbol.toUpperCase();

    if (!coin || !coin.price || places.length === 0) {
        return;
    }

    let place = places[0];
    // Whole coins only (fractions get rounded anyway); the difference is taken from the exact current amount,
    // so after adding it the portfolio holds exactly the typed number.
    const prefill = () => (context.hidden ? '' : String(Math.round(place.balance)));

    const input = h('input', {
        type: 'text',
        inputmode: 'numeric',
        autocomplete: 'off',
        placeholder: `New ${ticker} amount`,
        'aria-label': `New ${ticker} amount`
    });
    input.value = prefill();

    // Several portfolios hold this coin (overview): pick which one to change.
    const picker = places.length > 1
        ? h(
            'select',
            { class: `${EDITOR_CLASS}__portfolio`, 'aria-label': 'Portfolio' },
            ...places.map((item) => h(
                'option',
                { value: item.id },
                context.hidden ? item.name : `${item.name} · ${Math.round(item.balance)} ${ticker}`
            ))
        )
        : null;

    const status = h('div', { class: `${EDITOR_CLASS}__status` });
    const confirm = h('button', { type: 'button', class: `${EDITOR_CLASS}__confirm`, hidden: '' }, 'Add');
    const cancel = h('button', { type: 'button', class: `${EDITOR_CLASS}__cancel`, title: 'Close (Esc)' }, '✕');
    const editor = h(
        'div',
        { class: EDITOR_CLASS, role: 'dialog', 'aria-label': `Set ${ticker} amount` },
        picker,
        h('div', { class: `${EDITOR_CLASS}__row` }, input, confirm, cancel),
        status
    );

    let pending: { type: 'buy' | 'sell'; amount: string } | null = null;

    const preview = () => {
        const text = input.value.replace(/[\s_]/g, '');
        const value = Number(text);
        pending = null;
        confirm.hidden = true;
        status.className = `${EDITOR_CLASS}__status`;

        if (input.value.trim() === '') {
            status.textContent = 'Type the amount you have now';
            return;
        }

        if (!/^\d+$/.test(text) || !Number.isFinite(value)) {
            status.textContent = 'Whole coins only';
            status.classList.add(`${EDITOR_CLASS}__status--error`);
            return;
        }

        const diff = Number(formatAmount(value - place.balance));

        if (diff === 0) {
            status.textContent = 'Same as now — nothing to add';
            return;
        }

        pending = { type: diff > 0 ? 'buy' : 'sell', amount: formatAmount(Math.abs(diff)) };
        status.textContent = `${pending.type === 'buy' ? 'Buy' : 'Sell'} ${pending.amount} ${ticker} `
            + `@ $${formatPrice(coin.price)} ≈ $${(Math.abs(diff) * coin.price).toFixed(2)}`
            + `${places.length > 1 ? ` in ${place.name}` : ''}`;
        confirm.hidden = false;
    };

    const submit = async () => {
        if (!pending) return;

        confirm.disabled = true;
        input.disabled = true;
        status.textContent = 'Adding…';

        try {
            await addTransaction({
                type: pending.type,
                portfolioId: place.id,
                coinId: coin.id,
                amount: pending.amount,
                price: String(coin.price),
                note: 'Set amount (CMC Helper)'
            });
            status.textContent = 'Added ✓';
            setTimeout(() => {
                editor.remove();
                context.onAdded();
            }, 700);
        } catch (error) {
            status.textContent = (error as Error).message;
            status.classList.add(`${EDITOR_CLASS}__status--error`);
            confirm.disabled = false;
            input.disabled = false;
        }
    };

    input.addEventListener('input', preview);
    picker?.addEventListener('change', () => {
        place = places.find((item) => item.id === picker.value) ?? places[0];
        input.value = prefill();
        preview();
        input.focus();
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') submit();
        if (event.key === 'Escape') editor.remove();
    });
    confirm.addEventListener('click', submit);
    cancel.addEventListener('click', () => editor.remove());

    // Keep clicks inside the editor from reaching CMC's row handlers (which open the coin page).
    ['click', 'mousedown', 'pointerdown'].forEach((type) => {
        editor.addEventListener(type, (event) => event.stopPropagation());
    });

    cell.append(editor);
    preview();
    input.focus();
    input.select();
}

/**
 * Adds a ✎ over the amount cell of each row: Holdings on a single-portfolio table, Balance on the overview.
 * Idempotent; the button and the editor are absolutely positioned, so the table layout never changes.
 */
export function renderAmountEditors(context: AmountEditorContext) {
    const table = document.querySelector<HTMLTableElement>(TABLE_SELECTOR);

    if (!table) {
        return;
    }

    const overview = !!table.querySelector(OVERVIEW_SYMBOL_SELECTOR);
    const rows = [...table.querySelectorAll('tbody tr')];
    const symbolSelector = overview ? OVERVIEW_SYMBOL_SELECTOR : PORTFOLIO_SYMBOL_SELECTOR;
    const symbolOf = (row: Element) => row.querySelector(symbolSelector)?.textContent?.trim().toLowerCase();

    // Single-portfolio table: every row edits that portfolio. Overview: each coin's own portfolios.
    let portfolio: Portfolio | null = null;

    if (!overview) {
        const symbols = rows.map(symbolOf).filter((symbol): symbol is string => !!symbol);
        portfolio = identifyPortfolio(symbols, context.snapshot);

        if (!portfolio) {
            return;
        }
    }

    rows.forEach((row) => {
        const symbol = symbolOf(row);
        const cell = symbol && (overview ? findBalanceCell(table, row) : findHoldingsCell(row, symbol));

        if (!symbol || !cell) {
            return;
        }

        const all = placesOf(symbol, context.snapshot);
        const places = portfolio ? all.filter((item) => item.id === portfolio!.id) : all;

        if (portfolio && places.length === 0) {
            // Held here but sold to zero (not in CMC's holdings): editing starts from 0.
            places.push({ ...portfolio, balance: 0 });
        }

        if (places.length === 0) {
            return;
        }

        const key = `${places.map((item) => `${item.id}:${item.balance}`).join(',')}|${symbol}|${context.hidden}`;
        const existing = cell.querySelector<HTMLButtonElement>(`:scope > .${BUTTON_CLASS}`);

        if (existing?.dataset.key === key) {
            return;
        }

        existing?.remove();
        cell.classList.add(CELL_CLASS);

        const button = h(
            'button',
            { type: 'button', class: BUTTON_CLASS, title: `Set ${symbol.toUpperCase()} amount…` },
            '✎'
        );
        button.dataset.key = key;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openEditor(cell, symbol, places, context);
        });
        ['mousedown', 'pointerdown'].forEach((type) => {
            button.addEventListener(type, (event) => event.stopPropagation());
        });
        cell.append(button);
    });
}

// Close the editor when clicking elsewhere.
document.addEventListener('mousedown', (event) => {
    if (!(event.target as Element | null)?.closest?.(`.${EDITOR_CLASS}, .${BUTTON_CLASS}`)) {
        closeEditors();
    }
});
