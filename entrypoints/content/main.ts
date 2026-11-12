import { RequestSender } from './RequestSender';
import { BinanceLoader, BybitLoader, OkxLoader, MexcLoader } from './loaders';
import { renderEarnData } from './renderEarnData';
import { onTableReady } from './onTableReady';

import './styles.css';

export async function main() {
    const requestSender = new RequestSender();

    const binanceLoader = new BinanceLoader({ requestSender });
    const bybitLoader = new BybitLoader({ requestSender });
    const okxLoader = new OkxLoader({ requestSender });
    const mexcLoader = new MexcLoader({ requestSender });

    try {
        await binanceLoader.loadEarnData();
        await bybitLoader.loadEarnData();
        await okxLoader.loadEarnData();
        await mexcLoader.loadEarnData();
    } catch (error) {
        console.error(error);
    }

    onTableReady((tableEl) => {
        renderEarnData({ tableEl, binanceLoader, bybitLoader, okxLoader, mexcLoader });
    });
}
