import { BinanceLoader, BybitLoader, OkxLoader } from './loaders';
import { Exchange, getExchangeLogoId } from './enums';

type EarnData = {
    exchange: Exchange;
    apr: number;
}

interface IOptions {
    tableEl: HTMLTableElement;
    binanceLoader: BinanceLoader;
    bybitLoader: BybitLoader;
    okxLoader: OkxLoader;
}

export async function renderEarnData({ tableEl, okxLoader, bybitLoader, binanceLoader }: IOptions) {
    const isOverviewTable = tableEl.querySelector('.symbol-name');

    const colgroup = tableEl.querySelector('colgroup')!;
    colgroup.appendChild(document.createElement('col'));

    const headRowEl = tableEl.querySelector('thead tr')!;

    if (isOverviewTable) {
        headRowEl.appendChild(createTh());
    } else {
        const lastThEl = headRowEl.querySelector<HTMLElement>('th:last-child');
        lastThEl!.insertAdjacentElement('beforebegin', createTh());
    }

    const rowEls = tableEl.querySelectorAll('tbody tr');

    rowEls.forEach((row) => {
        const coinSymbolEl = row.querySelector('.symbol-name, .coin-item-symbol')!;
        const coinSymbol = coinSymbolEl.textContent.toLowerCase();

        const earnData: EarnData[] = [
            { exchange: Exchange.BINANCE, apr: binanceLoader.getCoinApr(coinSymbol) },
            { exchange: Exchange.BYBIT, apr: bybitLoader.getCoinApr(coinSymbol) },
            { exchange: Exchange.OKX, apr: okxLoader.getCoinApr(coinSymbol) }
        ];

        const td = createTd(earnData);

        if (isOverviewTable) {
            row.appendChild(td);
        } else {
            const lastTdEl = row.querySelector('td:last-child');
            lastTdEl!.insertAdjacentElement('beforebegin', td);
        }
    });
}

function createTh() {
    const th = document.createElement('th');
    th.textContent = 'Earn';
    th.style.textAlign = 'right';
    return th;
}

function createTd(earnData: EarnData[]): HTMLTableCellElement {
    const td = document.createElement('td');
    const maxAprExchanges = getMaxAprExchanges(earnData);

    earnData.forEach((data) => {
        if (data.apr > 0) {
            const el = createEarnEl(data);

            if (maxAprExchanges.includes(data.exchange)) {
                el.classList.add('cmc-helper-earn--max');
            }

            td.insertAdjacentElement('beforeend', el);
        }
    });

    return td;
}

function createEarnEl({ exchange, apr }: EarnData): Element {
    const div = document.createElement('div');

    div.innerHTML = `
        <div class="cmc-helper-earn">
            <img src="https://s2.coinmarketcap.com/static/img/earn-provider/64x64/${getExchangeLogoId(exchange)}.png">
            ${apr.toFixed(2)}%
        </div>
    `;

    return div.firstElementChild!;
}

function getMaxAprExchanges(data: EarnData[]): Exchange[] {
    const maxApr = Math.max(...data.map(({ apr }) => apr));
    return data.filter(({ apr }) => apr === maxApr).map(({ exchange }) => exchange);
}
