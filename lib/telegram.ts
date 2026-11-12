// Minimal Telegram Bot API client. Called from extension pages / the worker only (never content scripts),
// so the bot token never reaches coinmarketcap.com.

interface ApiResponse<T> {
    ok: boolean;
    result: T;
    description?: string;
}

interface Chat {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
}

async function call<T>(token: string, method: string, body: object = {}): Promise<T> {
    if (!token) {
        throw new Error('Bot token is missing');
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
    const json = await response.json() as ApiResponse<T>;

    if (!json.ok) {
        throw new Error(`Telegram: ${json.description ?? `HTTP ${response.status}`}`);
    }

    return json.result;
}

export const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export async function sendMessage(token: string, chatId: string, html: string) {
    if (!chatId) {
        throw new Error('Chat id is missing');
    }

    await call(token, 'sendMessage', {
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    });
}

/** Finds the chat of the latest message sent to the bot (the user should send /start first). */
export async function findLatestChat(token: string): Promise<{ id: string; name: string } | null> {
    const updates = await call<{ message?: { chat: Chat } }[]>(token, 'getUpdates');
    const chat = updates.map((update) => update.message?.chat).filter((c): c is Chat => !!c).pop();

    if (!chat) {
        return null;
    }

    return {
        id: String(chat.id),
        name: chat.title ?? chat.username ?? chat.first_name ?? String(chat.id)
    };
}
