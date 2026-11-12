// Content scripts can't make cross-origin requests, so they proxy them through the background worker,
// which has host_permissions for the exchange APIs. Extension pages and the worker fetch directly.

export const FETCH_MESSAGE = 'cmc-helper:fetch';

export interface FetchRequest {
    type: typeof FETCH_MESSAGE;
    url: string;
    init?: RequestInit;
}

export type FetchResponse =
    | { ok: true; data: unknown }
    | { ok: false; error: string };

const isContentScript = () => typeof window !== 'undefined' && window.location.protocol !== 'chrome-extension:';

export async function fetchDirect(url: string, init?: RequestInit): Promise<FetchResponse> {
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

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    let response: FetchResponse | undefined;

    if (isContentScript()) {
        const request: FetchRequest = { type: FETCH_MESSAGE, url, init };
        response = await chrome.runtime.sendMessage(request);
    } else {
        response = await fetchDirect(url, init);
    }

    if (!response) {
        throw new Error(`No response from background worker for ${url}`);
    }

    if (!response.ok) {
        throw new Error(response.error);
    }

    return response.data as T;
}
