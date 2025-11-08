interface IRequestParams {
    url: string;
    requestInit: RequestInit
}

const sendRequest = async (message: IRequestParams) => {
    const { url, requestInit } = message;
    const response = await fetch(url, requestInit);

    if (!response.ok) {
        const errorBody = await response.json();
        console.error(errorBody);
        // eslint-disable-next-line no-throw-literal
        throw { status: response.status, error: errorBody.error };
    }

    return response.json();
};

export default defineBackground(() => {
    chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
        if (message.type === 'sendRequest') {
            (async () => {
                try {
                    const data = await sendRequest(message);
                    console.error('Fetched data:', data);
                    sendResponse({ data });
                } catch (error) {
                    console.error('Error fetching data:', error);
                    sendResponse({ error });
                }
            })();

            return true;
        }
    });
});
