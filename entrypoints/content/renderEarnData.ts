import { BinanceLoader, BybitLoader, IEarnEntry, OkxLoader } from './loaders';
import { Exchange, getExchangeLogoId } from './enums';

type EarnData = {
    exchange: Exchange;
    aprs: IEarnEntry[];
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
            { exchange: Exchange.BINANCE, aprs: binanceLoader.getCoinApr(coinSymbol) },
            { exchange: Exchange.BYBIT, aprs: bybitLoader.getCoinApr(coinSymbol) },
            { exchange: Exchange.OKX, aprs: okxLoader.getCoinApr(coinSymbol) }
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
        if (data.aprs.length > 0) {
            const el = createEarnEl(data);

            if (maxAprExchanges.includes(data.exchange)) {
                el.classList.add('cmc-helper-earn--max');
            }

            td.insertAdjacentElement('beforeend', el);
        }
    });

    return td;
}

function createEarnEl({ exchange, aprs }: EarnData): Element {
    const div = document.createElement('div');

    const aprsContentEl = aprs.map((apr) => {
        const duration = apr.duration === '0' ? '∞' : `${apr.duration}d`;
        const classes = apr.duration === '0' ? 'cmc-helper-earn__tip--infinite' : '';
        return `<span class="cmc-helper-earn__tip ${classes}">
            ${duration}: ${apr.value.toFixed(2)}%
        </span>`;
    });

    div.innerHTML = `
        <div class="cmc-helper-earn">
            <div class="cmc-helper-earn__content">${aprsContentEl.join('')}</div>
            <img src="https://s2.coinmarketcap.com/static/img/earn-provider/64x64/${getExchangeLogoId(exchange)}.png">
        </div>
    `;

    return div.firstElementChild!;
}

function getMaxAprExchanges(data: EarnData[]): Exchange[] {
    const flexiEarns = data.flatMap((d) => d.aprs.filter((apr) => apr.duration === '0'));
    const maxApr = Math.max(...flexiEarns.map((e) => e.value));
    return data
        .filter(({ aprs }) => aprs.map((apr) => apr.value).includes(maxApr))
        .map(({ exchange }) => exchange);
}
