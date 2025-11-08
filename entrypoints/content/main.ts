import { RequestSender } from './RequestSender';
import { BinanceLoader, BybitLoader, OkxLoader } from './loaders';
import { renderEarnData } from './renderEarnData';
import './styles.css';

export async function main() {
    const requestSender = new RequestSender();

    const binanceLoader = new BinanceLoader({ requestSender });
    const bybitLoader = new BybitLoader({ requestSender });
    const okxLoader = new OkxLoader({ requestSender });

    try {
        await binanceLoader.loadEarnData();
        await bybitLoader.loadEarnData();
        await okxLoader.loadEarnData();
    } catch (error) {
        console.error(error);
    }

    onTableReady((tableEl) => {
        renderEarnData({ tableEl, binanceLoader, bybitLoader, okxLoader });
    });
}

function onTableReady(callback: (el: HTMLTableElement) => void) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((record) => {
            record.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) {
                    return;
                }

                const el: HTMLElement = node as HTMLElement;
                const tableEl = el.querySelector<HTMLTableElement>('.portfolio-tablelist-wrapper .cmc-table');

                if (tableEl) {
                    callback(tableEl);
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const tableEl = document.querySelector<HTMLTableElement>('.portfolio-tablelist-wrapper .cmc-table');

    if (tableEl) {
        callback(tableEl);
    }
}
