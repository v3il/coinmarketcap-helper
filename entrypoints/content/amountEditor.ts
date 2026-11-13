import { addTransaction, type PortfolioSnapshot } from './cmcApi';
import { h } from './dom';
import { TABLE_SELECTOR } from './render';

// "Set amount": the user types the coin amount they actually have (e.g. after staking rewards) and the extension
// adds a buy/sell transaction for the difference at the current price. Single-portfolio tables only.

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
    /** Called after a transaction was added, with the portfolio's name. */
    onAdded: (portfolioName: string) => void;
}

interface Portfolio {
    id: string;
    name: string;
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

function openEditor(cell: HTMLElement, symbol: string, portfolio: Portfolio, context: AmountEditorContext) {
    closeEditors();

    const coin = context.snapshot.coins.get(symbol);
    const holding = context.snapshot.holdings.get(symbol)?.find((place) => place.portfolioId === portfolio.id);
    const current = holding?.balance ?? 0;
    const ticker = symbol.toUpperCase();

    if (!coin || !coin.price) {
        return;
    }

    const input = h('input', {
        type: 'text',
        inputmode: 'numeric',
        autocomplete: 'off',
        placeholder: `New ${ticker} amount`,
        'aria-label': `New ${ticker} amount in ${portfolio.name}`
    });
    // Whole coins only (fractions get rounded anyway); the difference is taken from the exact current amount,
    // so after adding it the portfolio holds exactly the typed number.
    input.value = context.hidden ? '' : String(Math.round(current));

    const status = h('div', { class: `${EDITOR_CLASS}__status` });
    const confirm = h('button', { type: 'button', class: `${EDITOR_CLASS}__confirm`, hidden: '' }, 'Add');
    const cancel = h('button', { type: 'button', class: `${EDITOR_CLASS}__cancel`, title: 'Close (Esc)' }, '✕');
    const editor = h(
        'div',
        { class: EDITOR_CLASS, role: 'dialog', 'aria-label': `Set ${ticker} amount` },
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

        const diff = Number(formatAmount(value - current));

        if (diff === 0) {
            status.textContent = 'Same as now — nothing to add';
            return;
        }

        pending = { type: diff > 0 ? 'buy' : 'sell', amount: formatAmount(Math.abs(diff)) };
        status.textContent = `${pending.type === 'buy' ? 'Buy' : 'Sell'} ${pending.amount} ${ticker} `
            + `@ $${formatPrice(coin.price)} ≈ $${(Math.abs(diff) * coin.price).toFixed(2)}`;
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
                portfolioId: portfolio.id,
                coinId: coin.id,
                amount: pending.amount,
                price: String(coin.price),
                note: 'Set amount (CMC Helper)'
            });
            status.textContent = 'Added ✓';
            setTimeout(() => {
                editor.remove();
                context.onAdded(portfolio.name);
            }, 700);
        } catch (error) {
            status.textContent = (error as Error).message;
            status.classList.add(`${EDITOR_CLASS}__status--error`);
            confirm.disabled = false;
            input.disabled = false;
        }
    };

    input.addEventListener('input', preview);
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
 * Adds a ✎ button to the Holdings cell of each row in a single-portfolio table. Idempotent; the button and the
 * editor are absolutely positioned, so the table layout never changes.
 */
export function renderAmountEditors(context: AmountEditorContext) {
    const table = document.querySelector<HTMLTableElement>(TABLE_SELECTOR);

    if (!table || table.querySelector(OVERVIEW_SYMBOL_SELECTOR)) {
        return;
    }

    const rows = [...table.querySelectorAll('tbody tr')];
    const symbolOf = (row: Element) => row.querySelector(PORTFOLIO_SYMBOL_SELECTOR)?.textContent
        ?.trim().toLowerCase();
    const symbols = rows.map(symbolOf).filter((symbol): symbol is string => !!symbol);
    const portfolio = identifyPortfolio(symbols, context.snapshot);

    if (!portfolio) {
        return;
    }

    rows.forEach((row) => {
        const symbol = symbolOf(row);
        const cell = symbol ? findHoldingsCell(row, symbol) : null;

        if (!symbol || !cell) {
            return;
        }

        const key = `${portfolio.id}|${symbol}|${context.hidden}`;
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
            openEditor(cell, symbol, portfolio, context);
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
