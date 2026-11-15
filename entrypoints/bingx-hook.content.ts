// Runs in the BingX page itself (MAIN world): BingX signs its own API requests, so instead of calling the API
// the extension reads the Earn product list the page loads anyway and hands it to bingx-relay (isolated world).
// Nothing is changed or sent anywhere else; it only listens.

const PRODUCT_LIST_PATH = '/wealth-sales-trading/v1/product/list';

const BINGX_PAGE_MESSAGE = 'cmc-helper:bingx-page-products';

export default defineContentScript({
    matches: ['https://bingx.com/*'],
    world: 'MAIN',
    runAt: 'document_start',

    main() {
        const forward = (url: string, body: string) => {
            if (!url.includes(PRODUCT_LIST_PATH)) {
                return;
            }

            try {
                const json = JSON.parse(body);

                if (json?.code === 0 && Array.isArray(json.data?.result)) {
                    window.postMessage({ type: BINGX_PAGE_MESSAGE, result: json.data.result }, window.location.origin);
                }
            } catch {
                // Not JSON: ignore.
            }
        };

        // The site uses XHR (axios); fetch is covered too in case that changes.
        const { open, send } = XMLHttpRequest.prototype;

        XMLHttpRequest.prototype.open = function patchedOpen(this: XMLHttpRequest, ...args: unknown[]) {
            (this as XMLHttpRequest & { cmcHelperUrl?: string }).cmcHelperUrl = String(args[1]);
            return (open as (...a: unknown[]) => void).apply(this, args);
        };

        XMLHttpRequest.prototype.send = function patchedSend(this: XMLHttpRequest, ...args: unknown[]) {
            const url = (this as XMLHttpRequest & { cmcHelperUrl?: string }).cmcHelperUrl ?? '';

            if (url.includes(PRODUCT_LIST_PATH)) {
                this.addEventListener('load', () => {
                    if (this.responseType === '' || this.responseType === 'text') {
                        forward(url, this.responseText);
                    } else if (this.responseType === 'json') {
                        forward(url, JSON.stringify(this.response));
                    }
                });
            }

            return (send as (...a: unknown[]) => void).apply(this, args);
        };

        const originalFetch = window.fetch;

        window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
            const response = await originalFetch.apply(this, args);
            const input = args[0];
            const url = typeof input === 'string' ? input : (input as Request | URL).toString();

            if (url.includes(PRODUCT_LIST_PATH)) {
                response.clone().text().then((body) => forward(url, body)).catch(() => {});
            }

            return response;
        };
    }
});
