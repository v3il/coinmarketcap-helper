import { BinanceLoader, BybitLoader, OkxLoader } from './loaders';

interface IOptions {
    tableEl: HTMLTableElement;
    binanceLoader: BinanceLoader;
    bybitLoader: BybitLoader;
    okxLoader: OkxLoader;
}

enum Logo {
    BINANCE = '3',
    BYBIT = '13',
    OKX = '4'
}

export async function renderEarnData({ tableEl, okxLoader, bybitLoader, binanceLoader }: IOptions) {
    const colgroup = tableEl.querySelector('colgroup')!;
    colgroup.appendChild(document.createElement('col'));

    const headRowEl = tableEl.querySelector('thead tr')!;
    headRowEl!.appendChild(createTh());

    const rowEls = tableEl.querySelectorAll('tbody tr');

    rowEls.forEach((row) => {
        const coinSymbol = row.querySelector('.symbol-name, .coin-item-symbol')!.textContent.toLowerCase();
        const td = document.createElement('td');

        const binanceEarn = binanceLoader.getCoinApr(coinSymbol);
        const bybitEarn = bybitLoader.getCoinApr(coinSymbol);
        const okxEarn = okxLoader.getCoinApr(coinSymbol);

        if (binanceEarn > 0) {
            td.appendChild(createEarnEl(Logo.BINANCE, binanceEarn));
        }

        if (bybitEarn > 0) {
            td.appendChild(createEarnEl(Logo.BYBIT, bybitEarn));
        }

        if (okxEarn > 0) {
            td.appendChild(createEarnEl(Logo.OKX, okxEarn));
        }

        row.appendChild(td);
    });
}

function createTh() {
    const th = document.createElement('th');
    th.textContent = 'Earn';
    return th;
}

function createEarnEl(image: string, earnValue: number) {
    const div = document.createElement('div');

    div.classList.add('ch-earn');
    div.innerHTML = `
        <img src="https://s2.coinmarketcap.com/static/img/earn-provider/64x64/${image}.png" class="ch-earn__logo">
        ${earnValue.toFixed(2)}%
    `;

    return div;
}
