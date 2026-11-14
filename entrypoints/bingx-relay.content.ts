import { BINGX_PRODUCTS_MESSAGE, type BingxProductsMessage } from '@/lib/messages';

// Isolated world on bingx.com: passes the product list caught by bingx-hook to the worker.
const BINGX_PAGE_MESSAGE = 'cmc-helper:bingx-page-products';

export default defineContentScript({
    matches: ['https://bingx.com/*'],
    runAt: 'document_start',

    main() {
        window.addEventListener('message', (event) => {
            if (event.source !== window || event.data?.type !== BINGX_PAGE_MESSAGE) {
                return;
            }

            const message: BingxProductsMessage = { type: BINGX_PRODUCTS_MESSAGE, result: event.data.result };
            chrome.runtime.sendMessage(message).catch(() => {});
        });
    }
});
