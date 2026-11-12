import { useEffect, useState } from 'preact/hooks';
import { CHECK_NOW_MESSAGE } from '@/lib/messages';
import { getPortfolioSymbols } from '@/lib/portfolio';
import {
    DEFAULT_SETTINGS, lastCheckItem, portfolioItem, settingsItem, type CheckStatus, type Settings
} from '@/lib/storage';
import { findLatestChat, sendMessage } from '@/lib/telegram';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const formatTime = (ms: number) => new Date(ms).toLocaleString('uk-UA');

export function App() {
    const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
    const [saved, setSaved] = useState<Settings>(DEFAULT_SETTINGS);
    const [lastCheck, setLastCheck] = useState<CheckStatus | null>(null);
    const [symbols, setSymbols] = useState<string[]>([]);
    const [notice, setNotice] = useState<Notice>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        settingsItem.getValue().then((value) => {
            setForm(value);
            setSaved(value);
        });
        lastCheckItem.getValue().then(setLastCheck);
        getPortfolioSymbols().then(setSymbols);

        const unwatchCheck = lastCheckItem.watch(setLastCheck);
        const unwatchPortfolio = portfolioItem.watch(() => getPortfolioSymbols().then(setSymbols));

        return () => {
            unwatchCheck();
            unwatchPortfolio();
        };
    }, []);

    const update = <K extends keyof Settings>(key: K, value: Settings[K]) => (
        setForm((current) => ({ ...current, [key]: value }))
    );
    const dirty = JSON.stringify(form) !== JSON.stringify(saved);

    const run = async (action: () => Promise<string>) => {
        setBusy(true);
        setNotice(null);

        try {
            setNotice({ kind: 'ok', text: await action() });
        } catch (error) {
            setNotice({ kind: 'error', text: (error as Error).message });
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        const value: Settings = {
            botToken: form.botToken.trim(),
            chatId: form.chatId.trim(),
            minIncrease: Math.max(0.1, form.minIncrease || DEFAULT_SETTINGS.minIncrease),
            intervalHours: Math.min(24, Math.max(1, Math.round(form.intervalHours || DEFAULT_SETTINGS.intervalHours)))
        };

        await settingsItem.setValue(value);
        setForm(value);
        setSaved(value);
    };

    const onSave = (event: Event) => {
        event.preventDefault();
        run(async () => {
            await save();
            return 'Збережено';
        });
    };

    const onFindChat = () => run(async () => {
        const chat = await findLatestChat(form.botToken.trim());

        if (!chat) {
            throw new Error('Повідомлень боту не знайдено. Напиши йому /start і спробуй ще раз.');
        }

        update('chatId', chat.id);
        return `Знайдено чат «${chat.name}». Не забудь зберегти.`;
    });

    const onTest = () => run(async () => {
        await sendMessage(form.botToken.trim(), form.chatId.trim(), '✅ CMC Helper підключено');
        return 'Тестове повідомлення надіслано';
    });

    const onCheckNow = () => run(async () => {
        await save();
        const status: CheckStatus = await chrome.runtime.sendMessage({ type: CHECK_NOW_MESSAGE });

        if (!status.ok) {
            throw new Error(status.message);
        }

        return `Перевірено. ${status.message}`;
    });

    return (
        <main>
            <h1>CMC Helper</h1>

            <section>
                <h2>Сповіщення в Telegram</h2>
                <p class="hint">
                    Розширення раз на кілька годин перевіряє ставки для монет з твого портфоліо і пише,
                    коли найкраща ставка по монеті зросла.
                </p>

                <form onSubmit={onSave}>
                    <label>
                        <span>Токен бота</span>
                        <input
                            type="password"
                            autoComplete="off"
                            spellcheck={false}
                            placeholder="123456:ABC-DEF…"
                            value={form.botToken}
                            onInput={(e) => update('botToken', e.currentTarget.value)}
                        />
                        <small>
                            Створи бота в @BotFather. Токен зберігається лише локально в цьому браузері.
                        </small>
                    </label>

                    <label>
                        <span>Chat id</span>
                        <div class="row">
                            <input
                                value={form.chatId}
                                onInput={(e) => update('chatId', e.currentTarget.value)}
                            />
                            <button type="button" disabled={busy || !form.botToken} onClick={onFindChat}>
                                Знайти
                            </button>
                        </div>
                        <small>Напиши боту /start, потім натисни «Знайти».</small>
                    </label>

                    <div class="row">
                        <label>
                            <span>Мінімальний приріст, п.п.</span>
                            <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={form.minIncrease}
                                onInput={(e) => update('minIncrease', e.currentTarget.valueAsNumber)}
                            />
                        </label>

                        <label>
                            <span>Перевіряти кожні, год</span>
                            <input
                                type="number"
                                min="1"
                                max="24"
                                step="1"
                                value={form.intervalHours}
                                onInput={(e) => update('intervalHours', e.currentTarget.valueAsNumber)}
                            />
                        </label>
                    </div>

                    <div class="actions">
                        <button type="submit" class="primary" disabled={busy || !dirty}>Зберегти</button>
                        <button type="button" disabled={busy || !form.botToken || !form.chatId} onClick={onTest}>
                            Тестове повідомлення
                        </button>
                        <button type="button" disabled={busy} onClick={onCheckNow}>Перевірити зараз</button>
                    </div>

                    {notice && <p class={`notice notice--${notice.kind}`}>{notice.text}</p>}
                </form>
            </section>

            <section>
                <h2>Остання перевірка</h2>
                {lastCheck ? (
                    <p class={lastCheck.ok ? '' : 'error'}>
                        {`${formatTime(lastCheck.at)}: ${lastCheck.message}`}
                        {lastCheck.failedExchanges.length > 0
                            && ` (не відповіли: ${lastCheck.failedExchanges.join(', ')})`}
                    </p>
                ) : (
                    <p class="hint">Ще не було.</p>
                )}
            </section>

            <section>
                <h2>{`Монети (${symbols.length})`}</h2>
                {symbols.length > 0 ? (
                    <p class="symbols">{symbols.map((symbol) => symbol.toUpperCase()).join(', ')}</p>
                ) : (
                    <p class="hint">Відкрий портфоліо на CoinMarketCap — монети підтягнуться звідти.</p>
                )}
            </section>
        </main>
    );
}
