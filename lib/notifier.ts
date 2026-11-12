import { EXCHANGES, type Rate } from './exchanges';
import { getPortfolioSymbols } from './portfolio';
import { loadRates } from './rates';
import {
    knownRatesItem, lastCheckItem, settingsItem, type BestRate, type CheckStatus, type CoinSnapshot
} from './storage';
import { escapeHtml, sendMessage } from './telegram';

interface Alert {
    symbol: string;
    best: BestRate;
    previous: BestRate;
}

/** On equal APR, the shorter term is better. */
const isBetter = (a: Rate, b: Rate | null) => !b || a.apr > b.apr || (a.apr === b.apr && a.days < b.days);

function bestOf(snapshot: CoinSnapshot): BestRate | null {
    return Object.values(snapshot).reduce<BestRate | null>((best, rate) => (isBetter(rate, best) ? rate : best), null);
}

const describe = ({ apr, days, exchangeName }: BestRate) => (
    `${apr.toFixed(2)}% — ${escapeHtml(exchangeName)}, ${days === 0 ? '∞' : `${days}d`}`
);

const formatAlerts = (alerts: Alert[]) => [
    '📈 <b>Нові найкращі ставки</b>',
    '',
    ...alerts.map(({ symbol, best, previous }) => (
        `<b>${escapeHtml(symbol.toUpperCase())}</b>: ${describe(best)}\n<i>було ${describe(previous)}</i>`
    ))
].join('\n');

async function runCheck(): Promise<Omit<CheckStatus, 'at'>> {
    const settings = await settingsItem.getValue();

    if (!settings.botToken || !settings.chatId) {
        return { ok: false, message: 'Telegram не налаштовано', failedExchanges: [] };
    }

    const symbols = await getPortfolioSymbols();

    if (symbols.length === 0) {
        const message = 'Список монет порожній — відкрий портфоліо на CoinMarketCap';
        return { ok: false, message, failedExchanges: [] };
    }

    const { byCoin, failed } = await loadRates(EXCHANGES);
    const failedExchanges = failed.map((exchange) => exchange.name);

    if (failed.length === EXCHANGES.length) {
        return { ok: false, message: 'Жодна біржа не відповіла', failedExchanges };
    }

    const previous = await knownRatesItem.getValue();
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
            alerts.push({ symbol, best, previous: previousBest });
        }

        if (best) {
            next[symbol] = snapshot;
        }
    });

    let message = `Монет: ${symbols.length}, сповіщень: ${alerts.length}`;
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
            message = `Не вдалося надіслати в Telegram: ${(error as Error).message}`;
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
