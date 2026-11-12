import { FETCH_MESSAGE, type FetchRequest, type FetchResponse } from '@/utils/request';

async function proxyFetch({ url, init }: FetchRequest): Promise<FetchResponse> {
    try {
        const response = await fetch(url, init);

        if (!response.ok) {
            return { ok: false, error: `HTTP ${response.status} ${response.statusText} for ${url}` };
        }

        return { ok: true, data: await response.json() };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `${reason} (${url})` };
    }
}

export default defineBackground(() => {
    chrome.runtime.onMessage.addListener((message: FetchRequest, _sender, sendResponse) => {
        if (message?.type !== FETCH_MESSAGE) {
            return false;
        }

        proxyFetch(message).then(sendResponse);

        // Keep the message channel open for the async response.
        return true;
    });
});
