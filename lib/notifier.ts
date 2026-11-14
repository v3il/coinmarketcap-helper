import { effectiveApr, EXCHANGES, type Rate } from './exchanges';
import {
    currentApr, exchangeResolver, formatCoins, isRealisticRate, isShortTerm, withoutExcluded, type ExchangeResolver
} from './holdings';
import { getPortfolioSymbols } from './portfolio';
import { loadRates, type ExchangeRates } from './rates';
import {
    getSettings, holdingsItem, knownPromosItem, knownRatesItem, lastCheckItem,
    type BestRate, type CheckStatus, type CoinSnapshot
} from './storage';
import { refreshBingx } from './bingxRefresh';
import { escapeHtml, sendMessage } from './telegram';

/** A short fixed-term offer (promo) worth a look: announced once, again only if its APR goes up. */
interface Promo {
    symbol: string;
    exchangeName: string;
    apr: number;
    days: number;
    heldOn: string[];
    /** Coins the user has in the counted portfolios; null when unknown. */
    balance: number | null;
}

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
        const now = currentApr(exchange, list, balance);

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

/**
 * 🪙 USDT · MEXC · 2 days at 600.00%
 * ≈ +3.29% for the term = +3.29 USDT on all your USDT, if the per-user cap allows
 * 📍 Now on: Binance
 */
function formatPromo({ symbol, exchangeName, apr, days, heldOn, balance }: Promo) {
    const ticker = escapeHtml(symbol.toUpperCase());
    const forTerm = (apr * days) / 365;
    const coins = balance ? ` = +${formatCoins((balance * forTerm) / 100)} ${ticker} on all your ${ticker}` : '';

    return [
        `🪙 <b>${ticker}</b> · ${escapeHtml(exchangeName)} · <b>${days} ${days === 1 ? 'day' : 'days'}`
            + ` at ${apr.toFixed(2)}%</b>`,
        `≈ +${forTerm.toFixed(2)}% for the term${coins}, if the per-user cap allows`,
        ...(heldOn.length > 0 ? [`📍 Now on: ${heldOn.map(escapeHtml).join(', ')}`] : [])
    ].join('\n');
}

/** Splits blocks into messages that fit Telegram's limit, at coin boundaries. */
function pack<T>(items: T[], format: (item: T) => string): T[][] {
    const packs: T[][] = [];
    let current: T[] = [];
    let length = 0;

    items.forEach((item) => {
        const size = format(item).length + 2;

        if (current.length > 0 && length + size > MAX_MESSAGE_LENGTH) {
            packs.push(current);
            current = [];
            length = 0;
        }

        current.push(item);
        length += size;
    });

    if (current.length > 0) {
        packs.push(current);
    }

    return packs;
}

/** "📈 New best rates (1/2)" + the blocks. */
function formatPack(title: string, blocks: string[], index: number, total: number) {
    const part = total > 1 ? ` (${index + 1}/${total})` : '';
    return [`<b>${title}</b>${part}`, ...blocks].join('\n\n');
}

/** Where the coin sits: exchange names, or portfolio names for wallets. */
const placesOf = (places: { portfolio: string }[], resolve: ExchangeResolver) => (
    [...new Set(places.map(({ portfolio }) => resolve(portfolio)?.name ?? portfolio))]
);

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

    // BingX has no API: its rates come from its Earn page, loaded in a background tab if the user allowed it.
    if (settings.bingxAutoRefresh) {
        await refreshBingx();
    }

    const { byCoin, failed } = await loadRates(EXCHANGES);
    const failedExchanges = failed.map((exchange) => exchange.name);

    if (failed.length === EXCHANGES.length) {
        return { ok: false, message: 'No exchange responded', failedExchanges };
    }

    const previous = await knownRatesItem.getValue();
    const previousPromos = await knownPromosItem.getValue();
    const nextPromos: Record<string, number> = {};
    const promos: (Promo & { key: string })[] = [];
    const holdings = await holdingsItem.getValue();
    const resolve = exchangeResolver(settings.portfolioExchanges);
    const next: Record<string, CoinSnapshot> = {};
    const alerts: Alert[] = [];

    symbols.forEach((symbol) => {
        const old = previous[symbol] ?? {};
        const snapshot: CoinSnapshot = {};
        const places = withoutExcluded(holdings[symbol] ?? [], settings.excludedPortfolios);
        const balance = places.length > 0 && places.every((place) => place.balance !== undefined)
            ? places.reduce((sum, place) => sum + (place.balance ?? 0), 0)
            : null;

        (byCoin.get(symbol) ?? []).forEach(({ exchange, rates }) => {
            // Short promos (MEXC 2 days at 600%) aren't rates you can keep coins at: they get their own alerts.
            // Tiered rates (BingX) count at what the user's amount would actually earn.
            const best = rates.filter(isRealisticRate)
                .map(({ tiers, ...rate }) => ({ ...rate, apr: effectiveApr({ ...rate, tiers }, balance) }))
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

        const offers = (byCoin.get(symbol) ?? [])
            .flatMap(({ exchange, rates }) => rates.filter(isShortTerm).map((rate) => ({ exchange, ...rate })));

        offers.forEach(({ exchange, apr, days }) => {
            const key = `${symbol}|${exchange.id}|${days}`;
            const known = previousPromos[key];
            nextPromos[key] = apr;

            if (settings.promoAlerts && apr >= settings.minPromoApr
                && (known === undefined || apr >= known + settings.minIncrease)) {
                const heldOn = placesOf(places, resolve);
                promos.push({ key, symbol, exchangeName: exchange.name, apr, days, heldOn, balance });
            }
        });

        // Promos of exchanges that didn't respond are still running as far as we know.
        Object.entries(previousPromos).forEach(([key, apr]) => {
            if (failed.some(({ id }) => key.startsWith(`${symbol}|${id}|`))) {
                nextPromos[key] = apr;
            }
        });

        const best = bestOf(snapshot);
        const previousBest = bestOf(old);

        // New coins only get a baseline; alerts are for increases.
        if (best && previousBest && best.apr >= previousBest.apr + settings.minIncrease) {
            const list = byCoin.get(symbol) ?? [];

            // The coin already sits where the best rate is: nothing to do, no alert (the baseline still moves up).
            if (!places.some(({ portfolio }) => resolve(portfolio)?.id === best.exchangeId)) {
                const heldOn = placesOf(places, resolve);
                const positions = describePositions(symbol, places, best, list, resolve);
                alerts.push({ symbol, best, previous: previousBest, heldOn, positions });
            }
        }

        if (best) {
            next[symbol] = snapshot;
        }
    });

    let message = `Coins: ${symbols.length}, alerts: ${alerts.length}`
        + `${promos.length > 0 ? `, promos: ${promos.length}` : ''}`;
    let ok = true;

    // Each message knows how to undo its part, so whatever isn't delivered is retried on the next check.
    const rateTitle = `📈 New best ${alerts.length === 1 ? 'rate' : 'rates'}`;
    const ratePacks = pack(alerts, formatAlert);
    const promoTitle = `🎁 New ${promos.length === 1 ? 'promo' : 'promos'}`;
    const promoPacks = pack(promos, formatPromo);
    const messages = [
        ...ratePacks.map((items, i) => ({
            text: formatPack(rateTitle, items.map(formatAlert), i, ratePacks.length),
            undo: () => items.forEach(({ symbol }) => {
                next[symbol] = previous[symbol];
            })
        })),
        ...promoPacks.map((items, i) => ({
            text: formatPack(promoTitle, items.map(formatPromo), i, promoPacks.length),
            undo: () => items.forEach(({ key }) => {
                if (previousPromos[key] === undefined) {
                    delete nextPromos[key];
                } else {
                    nextPromos[key] = previousPromos[key];
                }
            })
        }))
    ];

    for (let i = 0; i < messages.length; i++) {
        try {
            await sendMessage(settings.botToken, settings.chatId, messages[i].text);
        } catch (error) {
            messages.slice(i).forEach(({ undo }) => undo());
            ok = false;
            message = `Failed to send to Telegram: ${(error as Error).message}`;
            break;
        }
    }

    await knownRatesItem.setValue(next);
    await knownPromosItem.setValue(nextPromos);

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
