// Cross-origin requests can't be made from the content script, so they are proxied
// through the background worker, which has host_permissions for the exchange APIs.

export const FETCH_MESSAGE = 'cmc-helper:fetch';

export interface FetchRequest {
    type: typeof FETCH_MESSAGE;
    url: string;
    init?: RequestInit;
}

export type FetchResponse =
    | { ok: true; data: unknown }
    | { ok: false; error: string };

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const request: FetchRequest = { type: FETCH_MESSAGE, url, init };
    const response: FetchResponse | undefined = await chrome.runtime.sendMessage(request);

    if (!response) {
        throw new Error(`No response from background worker for ${url}`);
    }

    if (!response.ok) {
        throw new Error(response.error);
    }

    return response.data as T;
}
