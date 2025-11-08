interface ISendRequestError {
    status: number;
    error: string;
}

interface ISendRequestResponse<D> {
    data?: D;
    error?: ISendRequestError;
}

export class RequestSender {
    sendRequest<
        R extends object = object
    >(url: string, requestInit: Partial<RequestInit> = {}): Promise<ISendRequestResponse<R>> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'sendRequest',
                url,
                requestInit
            }, resolve);
        });
    }
}
