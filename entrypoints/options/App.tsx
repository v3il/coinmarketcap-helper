import { useEffect, useState } from 'preact/hooks';
import { EXCHANGES } from '@/lib/exchanges';
import { guessExchange, NOT_AN_EXCHANGE } from '@/lib/holdings';
import { BINGX_EARN_URL } from '@/lib/exchanges/bingx';
import { BINGX_REFRESH_MESSAGE, CHECK_NOW_MESSAGE } from '@/lib/messages';
import { getPortfolioSymbols } from '@/lib/portfolio';
import {
    bingxRatesItem,
    DEFAULT_SETTINGS,
    getSettings,
    knownPortfoliosItem,
    lastCheckItem,
    portfolioItem,
    settingsItem,
    type BingxRates,
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
    const [bingxRates, setBingxRates] = useState<BingxRates | null>(null);
    const [bingxNotice, setBingxNotice] = useState<Notice>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getSettings().then((value) => {
            setForm(value);
            setSaved(value);
        });
        lastCheckItem.getValue().then(setLastCheck);
        bingxRatesItem.getValue().then(setBingxRates);
        getPortfolioSymbols().then(setSymbols);
        knownPortfoliosItem.getValue().then(setKnownPortfolios);

        const unwatchCheck = lastCheckItem.watch(setLastCheck);
        const unwatchPortfolio = portfolioItem.watch(() => getPortfolioSymbols().then(setSymbols));
        const unwatchKnown = knownPortfoliosItem.watch(setKnownPortfolios);
        const unwatchBingx = bingxRatesItem.watch(setBingxRates);

        return () => {
            unwatchCheck();
            unwatchPortfolio();
            unwatchKnown();
            unwatchBingx();
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
            minPositionUsd: Number.isFinite(form.minPositionUsd)
                ? Math.max(0, form.minPositionUsd)
                : DEFAULT_SETTINGS.minPositionUsd,
            promoAlerts: form.promoAlerts,
            bingxAutoRefresh: form.bingxAutoRefresh,
            minPromoApr: Number.isFinite(form.minPromoApr)
                ? Math.max(0, form.minPromoApr)
                : DEFAULT_SETTINGS.minPromoApr,
            excludedPortfolios: form.excludedPortfolios,
            portfolioExchanges: form.portfolioExchanges
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

    /** The exchange chosen for a portfolio, or the guess from its name if the user hasn't chosen yet. */
    const exchangeOf = (name: string) => form.portfolioExchanges[name] ?? guessExchange(name)?.id ?? NOT_AN_EXCHANGE;

    // Saves right away, like the checkboxes.
    const onPickExchange = async (name: string, exchangeId: string) => {
        const current = await getSettings();
        const portfolioExchanges = { ...current.portfolioExchanges, [name]: exchangeId };

        await settingsItem.setValue({ ...current, portfolioExchanges });
        setForm((value) => ({ ...value, portfolioExchanges }));
        setSaved((value) => ({ ...value, portfolioExchanges }));
    };

    // Saves right away, like the portfolio checkboxes.
    const onToggleBingx = async (bingxAutoRefresh: boolean) => {
        const current = await getSettings();

        await settingsItem.setValue({ ...current, bingxAutoRefresh });
        setForm((value) => ({ ...value, bingxAutoRefresh }));
        setSaved((value) => ({ ...value, bingxAutoRefresh }));
    };

    const onRefreshBingx = async () => {
        setBingxNotice({ kind: 'ok', text: 'Loading BingX in a background tab…' });
        const ok: boolean = await chrome.runtime.sendMessage({ type: BINGX_REFRESH_MESSAGE });
        setBingxNotice(ok
            ? { kind: 'ok', text: 'Rates updated' }
            : { kind: 'error', text: 'BingX didn’t load the rates. Open the Earn page yourself and try again.' });
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
                <h2>Portfolios</h2>
                <p class="hint">
                    Where each CoinMarketCap portfolio is held, so the Earn column can show where a coin earns
                    now and how much more it could. Guessed from the name until you pick. Uncheck “Counted”
                    for portfolios that aren’t investments, e.g. savings: they’re left out of the totals, the income
                    estimate and Telegram alerts.
                </p>
                {knownPortfolios.length > 0 ? (
                    <div class="portfolios">
                        <span class="portfolios__head">Portfolio</span>
                        <span class="portfolios__head">Held on</span>
                        <span class="portfolios__head">Counted</span>
                        {knownPortfolios.map((name) => [
                            <span key={`${name}-name`} class="portfolios__name">{name}</span>,
                            <select
                                key={`${name}-exchange`}
                                aria-label={`Where ${name} is held`}
                                value={exchangeOf(name)}
                                onChange={(e) => onPickExchange(name, e.currentTarget.value)}
                            >
                                {EXCHANGES.map((exchange) => (
                                    <option key={exchange.id} value={exchange.id}>{exchange.name}</option>
                                ))}
                                <option value={NOT_AN_EXCHANGE}>Wallet / other</option>
                            </select>,
                            <input
                                key={`${name}-totals`}
                                type="checkbox"
                                aria-label={`Count ${name} in totals, income and alerts`}
                                checked={!isExcluded(name)}
                                onChange={(e) => onTogglePortfolio(name, e.currentTarget.checked)}
                            />
                        ])}
                    </div>
                ) : (
                    <p class="hint">Open your portfolio on CoinMarketCap — the list is picked up from there.</p>
                )}
            </section>

            <section>
                <h2>BingX</h2>
                <p class="hint">
                    BingX has no public API for Earn rates. The extension reads them when its
                    {' '}
                    <a href={BINGX_EARN_URL} target="_blank" rel="noreferrer">Earn page</a>
                    {' '}
                    is open: when you visit it, or automatically before each check (the page opens in a background
                    tab for a few seconds and closes; focus stays where it is). New-user and VIP offers are skipped.
                </p>
                <p>
                    {bingxRates
                        ? `Rates from ${formatTime(bingxRates.at)} (${Object.keys(bingxRates.rates).length} coins)`
                        : 'No rates yet.'}
                </p>
                <div class="row">
                    <label class="checkbox">
                        <input
                            type="checkbox"
                            checked={form.bingxAutoRefresh}
                            onChange={(e) => onToggleBingx(e.currentTarget.checked)}
                        />
                        <span>Refresh automatically before each check</span>
                    </label>
                    <button type="button" onClick={onRefreshBingx}>Refresh now</button>
                </div>
                {bingxNotice && <p class={`notice notice--${bingxNotice.kind}`}>{bingxNotice.text}</p>}
            </section>

            <section>
                <h2>Telegram alerts</h2>
                <p class="hint">
                    Every few hours the extension checks rates for the coins in your portfolio and messages you
                    when the best rate for a coin goes up. Fixed terms up to 14 days are treated as promos: they
                    don’t count as the best rate and get their own alerts.
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

                    <label>
                        <span>Skip coins worth less than, $</span>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={form.minPositionUsd}
                            onInput={(e) => update('minPositionUsd', e.currentTarget.valueAsNumber)}
                        />
                        <small>
                            No alerts for coins you keep just to watch the price (counted portfolios only). 0 = all.
                        </small>
                    </label>

                    <div class="row">
                        <label class="checkbox">
                            <input
                                type="checkbox"
                                checked={form.promoAlerts}
                                onChange={(e) => update('promoAlerts', e.currentTarget.checked)}
                            />
                            <span>Promo alerts (up to 14 days)</span>
                        </label>

                        <label>
                            <span>Promos from, % APR</span>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={!form.promoAlerts}
                                value={form.minPromoApr}
                                onInput={(e) => update('minPromoApr', e.currentTarget.valueAsNumber)}
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
