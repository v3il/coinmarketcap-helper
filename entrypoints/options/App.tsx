import { useEffect, useState } from 'preact/hooks';
import { CHECK_NOW_MESSAGE } from '@/lib/messages';
import { getPortfolioSymbols } from '@/lib/portfolio';
import {
    DEFAULT_SETTINGS,
    getSettings,
    knownPortfoliosItem,
    lastCheckItem,
    portfolioItem,
    settingsItem,
    type CheckStatus,
    type Settings
} from '@/lib/storage';
import { findLatestChat, sendMessage } from '@/lib/telegram';

type Notice = { kind: 'ok' | 'error'; text: string } | null;

const formatTime = (ms: number) => new Date(ms).toLocaleString();

export function App() {
    const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
    const [saved, setSaved] = useState<Settings>(DEFAULT_SETTINGS);
    const [lastCheck, setLastCheck] = useState<CheckStatus | null>(null);
    const [symbols, setSymbols] = useState<string[]>([]);
    const [knownPortfolios, setKnownPortfolios] = useState<string[]>([]);
    const [notice, setNotice] = useState<Notice>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getSettings().then((value) => {
            setForm(value);
            setSaved(value);
        });
        lastCheckItem.getValue().then(setLastCheck);
        getPortfolioSymbols().then(setSymbols);
        knownPortfoliosItem.getValue().then(setKnownPortfolios);

        const unwatchCheck = lastCheckItem.watch(setLastCheck);
        const unwatchPortfolio = portfolioItem.watch(() => getPortfolioSymbols().then(setSymbols));
        const unwatchKnown = knownPortfoliosItem.watch(setKnownPortfolios);

        return () => {
            unwatchCheck();
            unwatchPortfolio();
            unwatchKnown();
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
            intervalHours: Math.min(24, Math.max(1, Math.round(form.intervalHours || DEFAULT_SETTINGS.intervalHours))),
            excludedPortfolios: form.excludedPortfolios
        };

        await settingsItem.setValue(value);
        setForm(value);
        setSaved(value);
    };

    const onSave = (event: Event) => {
        event.preventDefault();
        run(async () => {
            await save();
            return 'Saved';
        });
    };

    const isExcluded = (name: string) => form.excludedPortfolios
        .some((excluded) => excluded.toLowerCase() === name.toLowerCase());

    // Checkboxes save right away: only the excluded list changes, other unsaved edits stay as they are.
    const onTogglePortfolio = async (name: string, included: boolean) => {
        const current = await getSettings();
        const rest = current.excludedPortfolios.filter((excluded) => excluded.toLowerCase() !== name.toLowerCase());
        const excludedPortfolios = included ? rest : [...rest, name];

        await settingsItem.setValue({ ...current, excludedPortfolios });
        setForm((value) => ({ ...value, excludedPortfolios }));
        setSaved((value) => ({ ...value, excludedPortfolios }));
    };

    const onFindChat = () => run(async () => {
        const chat = await findLatestChat(form.botToken.trim());

        if (!chat) {
            throw new Error('No messages to the bot found. Send it /start and try again.');
        }

        update('chatId', chat.id);
        return `Found chat “${chat.name}”. Don't forget to save.`;
    });

    const onTest = () => run(async () => {
        await sendMessage(form.botToken.trim(), form.chatId.trim(), '✅ CMC Helper is connected');
        return 'Test message sent';
    });

    const onCheckNow = () => run(async () => {
        await save();
        const status: CheckStatus = await chrome.runtime.sendMessage({ type: CHECK_NOW_MESSAGE });

        if (!status.ok) {
            throw new Error(status.message);
        }

        return `Checked. ${status.message}`;
    });

    return (
        <main>
            <h1>CMC Helper</h1>

            <section>
                <h2>Portfolio totals</h2>
                <p class="hint">
                    Portfolios counted in the totals banner on CoinMarketCap. Uncheck the ones that aren’t
                    investments, e.g. savings.
                </p>
                {knownPortfolios.length > 0 ? (
                    <div class="checks">
                        {knownPortfolios.map((name) => (
                            <label class="check" key={name}>
                                <input
                                    type="checkbox"
                                    checked={!isExcluded(name)}
                                    onChange={(e) => onTogglePortfolio(name, e.currentTarget.checked)}
                                />
                                <span>{name}</span>
                            </label>
                        ))}
                    </div>
                ) : (
                    <p class="hint">Open your portfolio on CoinMarketCap — the list is picked up from there.</p>
                )}
            </section>

            <section>
                <h2>Telegram alerts</h2>
                <p class="hint">
                    Every few hours the extension checks rates for the coins in your portfolio and messages you
                    when the best rate for a coin goes up.
                </p>

                <form onSubmit={onSave}>
                    <label>
                        <span>Bot token</span>
                        <input
                            type="password"
                            autoComplete="off"
                            spellcheck={false}
                            placeholder="123456:ABC-DEF…"
                            value={form.botToken}
                            onInput={(e) => update('botToken', e.currentTarget.value)}
                        />
                        <small>
                            Create a bot with @BotFather. The token is stored only locally in this browser.
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
                                Find
                            </button>
                        </div>
                        <small>Send /start to your bot, then press “Find”.</small>
                    </label>

                    <div class="row">
                        <label>
                            <span>Minimum increase, pp</span>
                            <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={form.minIncrease}
                                onInput={(e) => update('minIncrease', e.currentTarget.valueAsNumber)}
                            />
                        </label>

                        <label>
                            <span>Check every, hours</span>
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
                        <button type="submit" class="primary" disabled={busy || !dirty}>Save</button>
                        <button type="button" disabled={busy || !form.botToken || !form.chatId} onClick={onTest}>
                            Send test message
                        </button>
                        <button type="button" disabled={busy} onClick={onCheckNow}>Check now</button>
                    </div>

                    {notice && <p class={`notice notice--${notice.kind}`}>{notice.text}</p>}
                </form>
            </section>

            <section>
                <h2>Last check</h2>
                {lastCheck ? (
                    <p class={lastCheck.ok ? '' : 'error'}>
                        {`${formatTime(lastCheck.at)}: ${lastCheck.message}`}
                        {lastCheck.failedExchanges.length > 0
                            && ` (no response: ${lastCheck.failedExchanges.join(', ')})`}
                    </p>
                ) : (
                    <p class="hint">Not yet.</p>
                )}
            </section>

            <section>
                <h2>{`Coins (${symbols.length})`}</h2>
                {symbols.length > 0 ? (
                    <p class="symbols">{symbols.map((symbol) => symbol.toUpperCase()).join(', ')}</p>
                ) : (
                    <p class="hint">Open your portfolio on CoinMarketCap — the coins are picked up from there.</p>
                )}
            </section>
        </main>
    );
}
