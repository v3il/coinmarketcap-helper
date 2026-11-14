import { EXCHANGES, type Rate } from './exchanges';
import {
    currentApr, exchangeResolver, formatCoins, isRealisticRate, withoutExcluded, type ExchangeResolver
} from './holdings';
import { getPortfolioSymbols } from './portfolio';
import { loadRates, type ExchangeRates } from './rates';
import {
    getSettings, holdingsItem, knownRatesItem, lastCheckItem, type BestRate, type CheckStatus, type CoinSnapshot
} from './storage';
import { escapeHtml, sendMessage } from './telegram';

interface Alert {
    symbol: string;
    best: BestRate;
    previous: BestRate;
    /** Where the user holds the coin now: exchange names, or portfolio names for wallets. */
    heldOn: string[];
    /** Where the user holds the coin and what moving it to the best rate would add. */
    positions: string[];
}

/** On equal APR, the shorter term is better. */
const isBetter = (a: Rate, b: Rate | null) => !b || a.apr > b.apr || (a.apr === b.apr && a.days < b.days);

function bestOf(snapshot: CoinSnapshot): BestRate | null {
    // Baselines saved before short promos were ignored may still hold one; skip it.
    return Object.values(snapshot).filter(isRealisticRate)
        .reduce<BestRate | null>((best, rate) => (isBetter(rate, best) ? rate : best), null);
}

const term = (days: number, unbondingDays?: number) => {
    if (days > 0) return `${days} days`;
    return unbondingDays ? `flexible, ${unbondingDays}-day withdrawal` : 'flexible';
};

/** "7.37% · Binance · flexible", "6.50% · Ready · flexible, 7-day withdrawal" */
const describe = ({ apr, days, unbondingDays, exchangeName }: BestRate) => (
    `${apr.toFixed(2)}% · ${escapeHtml(exchangeName)} · ${term(days, unbondingDays)}`
);

const usd = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: value < 10 ? 2 : 0
}).format(value);

/**
 * "💼 Bybit: ~0.10% = $0.30/yr → +$22/yr on Binance" for every place where the best rate would earn
 * noticeably more. "Now" assumes the best rate of the exchange the coin sits on (0% in wallets).
 */
function describePositions(
    symbol: string,
    holdings: { portfolio: string; value: number; balance?: number }[],
    best: BestRate,
    list: ExchangeRates[],
    resolve: ExchangeResolver
): string[] {
    const ticker = escapeHtml(symbol.toUpperCase());

    return holdings.flatMap(({ portfolio, value, balance }) => {
        const exchange = resolve(portfolio);
        const now = currentApr(exchange, list);

        // Noticeable only: worth at least ~$0.50 a year.
        if ((value * (best.apr - now)) / 100 < 0.5) {
            return [];
        }

        // Coins per year when the amount is known (older data has only the USD value).
        const perYear = (apr: number) => (balance === undefined
            ? `${usd((value * apr) / 100)}/yr`
            : `${formatCoins((balance * apr) / 100)} ${ticker}/yr`);
        const place = escapeHtml(exchange?.name ?? portfolio);

        return [
            `💼 ${place}: ~${now.toFixed(2)}% = ${perYear(now)}`
                + ` → <b>+${perYear(best.apr - now)}</b> on ${escapeHtml(best.exchangeName)}`
        ];
    });
}

/**
 * 🪙 BERA
 * 🔥 7.37% · Binance · flexible
 * ↗️ +2.19 pp (was 5.18% · Binance · flexible)
 * 📍 Now on: Bybit, Telegram
 * 💼 Bybit: ~0.10% = $0.30/yr → +$22/yr on Binance
 */
const formatAlert = ({ symbol, best, previous, heldOn, positions }: Alert) => [
    `🪙 <b>${escapeHtml(symbol.toUpperCase())}</b>`,
    `🔥 <b>${describe(best)}</b>`,
    `↗️ +${(best.apr - previous.apr).toFixed(2)} pp <i>(was ${describe(previous)})</i>`,
    ...(heldOn.length > 0 ? [`📍 Now on: ${heldOn.map(escapeHtml).join(', ')}`] : []),
    ...positions
].join('\n');

/** Telegram allows 4096 characters per message; keep a margin for the header. */
const MAX_MESSAGE_LENGTH = 3800;

/** Splits alerts into messages that fit Telegram's limit, at coin boundaries. */
function packAlerts(alerts: Alert[]): Alert[][] {
    const packs: Alert[][] = [];
    let current: Alert[] = [];
    let length = 0;

    alerts.forEach((alert) => {
        const size = formatAlert(alert).length + 2;

        if (current.length > 0 && length + size > MAX_MESSAGE_LENGTH) {
            packs.push(current);
            current = [];
            length = 0;
        }

        current.push(alert);
        length += size;
    });

    if (current.length > 0) {
        packs.push(current);
    }

    return packs;
}

function formatPack(pack: Alert[], index: number, total: number) {
    const title = `New best ${pack.length === 1 && total === 1 ? 'rate' : 'rates'}`;
    const part = total > 1 ? ` (${index + 1}/${total})` : '';
    return [`📈 <b>${title}</b>${part}`, ...pack.map(formatAlert)].join('\n\n');
}

async function runCheck(): Promise<Omit<CheckStatus, 'at'>> {
    const settings = await getSettings();

    if (!settings.botToken || !settings.chatId) {
        return { ok: false, message: 'Telegram is not configured', failedExchanges: [] };
    }

    const symbols = await getPortfolioSymbols();

    if (symbols.length === 0) {
        const message = 'No coins yet — open your portfolio on CoinMarketCap';
        return { ok: false, message, failedExchanges: [] };
    }

    const { byCoin, failed } = await loadRates(EXCHANGES);
    const failedExchanges = failed.map((exchange) => exchange.name);

    if (failed.length === EXCHANGES.length) {
        return { ok: false, message: 'No exchange responded', failedExchanges };
    }

    const previous = await knownRatesItem.getValue();
    const holdings = await holdingsItem.getValue();
    const resolve = exchangeResolver(settings.portfolioExchanges);
    const next: Record<string, CoinSnapshot> = {};
    const alerts: Alert[] = [];

    symbols.forEach((symbol) => {
        const old = previous[symbol] ?? {};
        const snapshot: CoinSnapshot = {};

        (byCoin.get(symbol) ?? []).forEach(({ exchange, rates }) => {
            // Short promos (MEXC 1–2 days at 600%) aren't rates you can keep coins at: no alerts for them.
            const best = rates.filter(isRealisticRate)
                .reduce<Rate | null>((acc, rate) => (isBetter(rate, acc) ? rate : acc), null);

            if (best) {
                snapshot[exchange.id] = { ...best, exchangeId: exchange.id, exchangeName: exchange.name };
            }
        });

        // Exchanges that didn't respond keep their last known rate, so an outage
        // doesn't lower the baseline (and trigger a fake "new best" once they're back).
        failed.forEach(({ id }) => {
            if (old[id]) {
                snapshot[id] = old[id];
            }
        });

        const best = bestOf(snapshot);
        const previousBest = bestOf(old);

        // New coins only get a baseline; alerts are for increases.
        if (best && previousBest && best.apr >= previousBest.apr + settings.minIncrease) {
            const list = byCoin.get(symbol) ?? [];
            const places = withoutExcluded(holdings[symbol] ?? [], settings.excludedPortfolios);
            const exchanges = places.map(({ portfolio }) => resolve(portfolio));

            // The coin already sits where the best rate is: nothing to do, no alert (the baseline still moves up).
            if (!exchanges.some((exchange) => exchange?.id === best.exchangeId)) {
                const heldOn = [...new Set(places.map(({ portfolio }, i) => exchanges[i]?.name ?? portfolio))];
                const positions = describePositions(symbol, places, best, list, resolve);
                alerts.push({ symbol, best, previous: previousBest, heldOn, positions });
            }
        }

        if (best) {
            next[symbol] = snapshot;
        }
    });

    let message = `Coins: ${symbols.length}, alerts: ${alerts.length}`;
    let ok = true;

    const packs = packAlerts(alerts);

    for (let i = 0; i < packs.length; i++) {
        try {
            await sendMessage(settings.botToken, settings.chatId, formatPack(packs[i], i, packs.length));
        } catch (error) {
            // Keep the old baselines for the alerts not sent yet, so they're retried on the next check.
            packs.slice(i).flat().forEach(({ symbol }) => {
                next[symbol] = previous[symbol];
            });
            ok = false;
            message = `Failed to send to Telegram: ${(error as Error).message}`;
            break;
        }
    }

    await knownRatesItem.setValue(next);

    return { ok, message, failedExchanges };
}

let running: Promise<CheckStatus> | null = null;

/** Checks portfolio coins for new best rates and notifies Telegram. Concurrent calls share one run. */
export function checkRates(): Promise<CheckStatus> {
    running ??= (async () => {
        let status: CheckStatus;

        try {
            status = { at: Date.now(), ...await runCheck() };
        } catch (error) {
            status = { at: Date.now(), ok: false, message: (error as Error).message, failedExchanges: [] };
        }

        await lastCheckItem.setValue(status);
        return status;
    })().finally(() => {
        running = null;
    });

    return running;
}
