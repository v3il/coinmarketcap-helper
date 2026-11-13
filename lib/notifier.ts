import { EXCHANGES, type Rate } from './exchanges';
import { currentApr, exchangeResolver, type ExchangeResolver } from './holdings';
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
    /** Where the user holds the coin and what moving it to the best rate would add. */
    positions: string[];
}

/** On equal APR, the shorter term is better. */
const isBetter = (a: Rate, b: Rate | null) => !b || a.apr > b.apr || (a.apr === b.apr && a.days < b.days);

function bestOf(snapshot: CoinSnapshot): BestRate | null {
    return Object.values(snapshot).reduce<BestRate | null>((best, rate) => (isBetter(rate, best) ? rate : best), null);
}

const term = (days: number) => (days === 0 ? 'flexible' : `${days} days`);

/** "7.37% · Binance · flexible" */
const describe = ({ apr, days, exchangeName }: BestRate) => (
    `${apr.toFixed(2)}% · ${escapeHtml(exchangeName)} · ${term(days)}`
);

const usd = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: value < 10 ? 2 : 0
}).format(value);

/**
 * "💼 Bybit: ~0.10% = $0.30/yr → +$22/yr on Binance" for every place where the best rate would earn
 * noticeably more. "Now" assumes the best rate of the exchange the coin sits on (0% in wallets).
 */
function describePositions(
    holdings: { portfolio: string; value: number }[],
    best: BestRate,
    list: ExchangeRates[],
    resolve: ExchangeResolver
): string[] {
    return holdings.flatMap(({ portfolio, value }) => {
        const exchange = resolve(portfolio);
        const now = currentApr(exchange, list);
        const extra = (value * (best.apr - now)) / 100;

        if (extra < 0.5) {
            return [];
        }

        const place = escapeHtml(exchange?.name ?? portfolio);
        const income = usd((value * now) / 100);
        return [
            `💼 ${place}: ~${now.toFixed(2)}% = ${income}/yr`
                + ` → <b>+${usd(extra)}/yr</b> on ${escapeHtml(best.exchangeName)}`
        ];
    });
}

/**
 * 🪙 BERA
 * 🔥 7.37% · Binance · flexible
 * ↗️ +2.19 pp (was 5.18% · Binance · flexible)
 * 💼 Bybit: ~0.10% = $0.30/yr → +$22/yr on Binance
 */
const formatAlerts = (alerts: Alert[]) => [
    `📈 <b>New best ${alerts.length === 1 ? 'rate' : 'rates'}</b>`,
    ...alerts.map(({ symbol, best, previous, positions }) => [
        `🪙 <b>${escapeHtml(symbol.toUpperCase())}</b>`,
        `🔥 <b>${describe(best)}</b>`,
        `↗️ +${(best.apr - previous.apr).toFixed(2)} pp <i>(was ${describe(previous)})</i>`,
        ...positions
    ].join('\n'))
].join('\n\n');

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
            const best = rates.reduce<Rate | null>((acc, rate) => (isBetter(rate, acc) ? rate : acc), null);

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
            const positions = describePositions(holdings[symbol] ?? [], best, byCoin.get(symbol) ?? [], resolve);
            alerts.push({ symbol, best, previous: previousBest, positions });
        }

        if (best) {
            next[symbol] = snapshot;
        }
    });

    let message = `Coins: ${symbols.length}, alerts: ${alerts.length}`;
    let ok = true;

    if (alerts.length > 0) {
        try {
            await sendMessage(settings.botToken, settings.chatId, formatAlerts(alerts));
        } catch (error) {
            // Keep the old baselines so these alerts are retried on the next check.
            alerts.forEach(({ symbol }) => {
                next[symbol] = previous[symbol];
            });
            ok = false;
            message = `Failed to send to Telegram: ${(error as Error).message}`;
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
