import { RequestSender } from '@/entrypoints/content/RequestSender';
import { BinanceLoader, BybitLoader, OkxLoader } from '@/entrypoints/content/loaders';

export async function main() {
    const requestSender = new RequestSender();

    const binanceLoader = new BinanceLoader({ requestSender });
    const bybitLoader = new BybitLoader({ requestSender });
    const okxLoader = new OkxLoader({ requestSender });

    try {
        await binanceLoader.loadEarnData();
        console.error(binanceLoader.getCoinApr('ena'));
        console.error(binanceLoader.getCoinApr('lista'));
    } catch (error) {
        console.error(error);
    }

    try {
        await bybitLoader.loadEarnData();
        console.error(bybitLoader.getCoinApr('ena'));
    } catch (error) {
        console.error(error);
    }

    try {
        await okxLoader.loadEarnData();
        console.error(okxLoader.getCoinApr('ena'));
    } catch (error) {
        console.error(error);
    }
}
