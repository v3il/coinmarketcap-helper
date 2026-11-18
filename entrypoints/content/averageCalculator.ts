import {
    afterBuy, formatChange, formatCoins, formatPrice, parseUsd, positionStats, type PositionStats
} from '@/lib/averaging';
import { h } from './dom';

// Average price calculator (🧮 next to Set amount): type how many dollars you'd add and see the new average price
// and drawdown. Information only — it never adds a transaction.

const EDITOR_CLASS = 'cmc-helper-editor';
const CALC_CLASS = 'cmc-helper-calc';

/** A coin's position in one portfolio, with what it cost (CMC's value − P/L), USD. */
export interface CalcPlace {
    id: string;
    name: string;
    coins: number;
    cost: number;
}

const priceText = ({ average }: PositionStats) => (average === null ? 'paid back' : `$${formatPrice(average)}`);
const changeText = ({ change }: PositionStats) => (change === null ? '—' : formatChange(change));

/** `hidden`: CMC hides balances, so the coin count isn't shown either. */
export function openCalculator(cell: HTMLElement, ticker: string, price: number, places: CalcPlace[], hidden: boolean) {
    if (places.length === 0 || !(price > 0)) {
        return;
    }

    let place = places[0];

    const picker = places.length > 1
        ? h(
            'select',
            { class: `${EDITOR_CLASS}__portfolio`, 'aria-label': 'Portfolio' },
            ...places.map((item) => h('option', { value: item.id }, item.name))
        )
        : null;

    const input = h('input', {
        type: 'text',
        inputmode: 'decimal',
        autocomplete: 'off',
        placeholder: 'Buy for $',
        'aria-label': `Buy ${ticker} for, USD`
    });
    const cancel = h('button', { type: 'button', class: `${EDITOR_CLASS}__cancel`, title: 'Close (Esc)' }, '✕');
    const averageLine = h('div');
    const changeLine = h('div');
    const coinsLine = h('div');
    const result = h(
        'div',
        { class: `${CALC_CLASS}__result`, 'aria-live': 'polite' },
        averageLine,
        changeLine,
        coinsLine
    );
    const editor = h(
        'div',
        { class: EDITOR_CLASS, role: 'dialog', 'aria-label': `Average ${ticker} price` },
        picker,
        h('div', { class: `${EDITOR_CLASS}__row` }, input, cancel),
        result
    );

    const update = () => {
        const now = positionStats(place, price);
        const text = input.value.trim();
        const usd = parseUsd(text);
        result.classList.remove(`${CALC_CLASS}__result--error`);
        coinsLine.textContent = '';

        if (text === '') {
            averageLine.textContent = `Avg ${priceText(now)} · ${changeText(now)}`;
            changeLine.textContent = 'Type how many dollars you\'d add';
            return;
        }

        if (usd === null) {
            averageLine.textContent = 'Type a dollar amount';
            changeLine.textContent = '';
            result.classList.add(`${CALC_CLASS}__result--error`);
            return;
        }

        const position = afterBuy(place, price, usd);
        const after = positionStats(position, price);
        averageLine.replaceChildren(`Avg ${priceText(now)} → `, h('b', {}, priceText(after)));
        changeLine.replaceChildren(`${changeText(now)} → `, h('b', {}, changeText(after)));

        if (!hidden) {
            coinsLine.replaceChildren(
                `${formatCoins(place.coins)} → `,
                h('b', {}, `${formatCoins(position.coins)} ${ticker}`)
            );
        }
    };

    input.addEventListener('input', update);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') editor.remove();
    });
    picker?.addEventListener('change', () => {
        place = places.find((item) => item.id === picker.value) ?? places[0];
        update();
        input.focus();
    });
    cancel.addEventListener('click', () => editor.remove());

    // Keep clicks inside the popup from reaching CMC's row handlers (which open the coin page).
    ['click', 'mousedown', 'pointerdown'].forEach((type) => {
        editor.addEventListener(type, (event) => event.stopPropagation());
    });

    cell.append(editor);
    update();
    input.focus();
}
