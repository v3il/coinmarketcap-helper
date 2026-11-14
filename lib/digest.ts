// Weekly Telegram summary: what the portfolio earns now, what it could earn, and the moves worth making.
// Alerts only fire when a rate goes up; this also catches coins that have been sitting at a poor rate all along.

import {
    bestIncomeRate, currentApr, estimateIncome, exchangeResolver, formatCoins, isShortTerm, withoutExcluded,
    type IncomeRate
} from './holdings';
import type { LoadedRates } from './rates';
import { holdingsItem, lastDigestItem, type Settings } from './storage';
import { escapeHtml, sendMessage } from './telegram';

/** Moves that add less than this a year, USD, aren't worth the hassle. */
const MIN_GAIN_USD = 0.5;
const MAX_MOVES = 5;
const MAX_PROMOS = 5;
/** Local hour of the digest day from which the summary goes out (with the first check after it). */
const DIGEST_HOUR = 9;

export const usd = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: value < 10 ? 2 : 0
}).format(value);

type Position = { portfolio: string; value: number; balance?: number };

interface Move {
    symbol: string;
    place: string;
    nowApr: number;
    best: IncomeRate;
    gainUsd: number;
    gainCoins: number | null;
}

interface DigestPromo {
    symbol: string;
    exchangeName: string;
    apr: number;
    days: number;
}

export interface DigestInput {
    rates: LoadedRates;
    /** Lower-case symbol -> positions, as last seen on CMC. */
    holdings: Record<string, Position[]>;
    settings: Pick<Settings, 'excludedPortfolios' | 'portfolioExchanges' | 'minPositionUsd' | 'promoAlerts'
        | 'minPromoApr'>;
}

const term = (days: number) => (days > 0 ? `${days} days` : 'flexible');

/** The summary message, or null when there's nothing to sum up (no positions seen yet). */
export function buildDigest({ rates, holdings, settings }: DigestInput): string | null {
    const resolve = exchangeResolver(settings.portfolioExchanges);
    let value = 0;
    let now = 0;
    let best = 0;
    let withRates = 0;
    let optimal = 0;
    const moves: Move[] = [];
    const promos: DigestPromo[] = [];

    Object.entries(holdings).forEach(([symbol, all]) => {
        const places = withoutExcluded(all, settings.excludedPortfolios);
        const list = rates.byCoin.get(symbol) ?? [];

        if (places.length === 0) {
            return;
        }

        const income = estimateIncome(places, list, resolve);
        value += income.value;
        now += income.now;
        best += income.best;

        // Coins kept just to watch the price count in the totals, but get no suggestions.
        if (income.value < settings.minPositionUsd || !income.bestRate) {
            return;
        }

        withRates++;
        const ticker = symbol.toUpperCase();
        const coinMoves = places.flatMap(({ portfolio, value: placeValue, balance }) => {
            const exchange = resolve(portfolio);
            const nowApr = currentApr(exchange, list, balance);
            const target = bestIncomeRate(list, balance);
            const gainUsd = target ? (placeValue * (target.apr - nowApr)) / 100 : 0;

            if (!target || target.exchange.id === exchange?.id || gainUsd < MIN_GAIN_USD) {
                return [];
            }

            const gainCoins = balance === undefined ? null : (balance * (target.apr - nowApr)) / 100;
            return [{ symbol: ticker, place: exchange?.name ?? portfolio, nowApr, best: target, gainUsd, gainCoins }];
        });

        if (coinMoves.length === 0) {
            optimal++;
        }

        moves.push(...coinMoves);

        if (settings.promoAlerts) {
            list.forEach(({ exchange, rates: offers }) => offers
                .filter((rate) => isShortTerm(rate) && rate.apr >= settings.minPromoApr)
                .forEach(({ apr, days }) => promos.push({ symbol: ticker, exchangeName: exchange.name, apr, days })));
        }
    });

    if (value <= 0) {
        return null;
    }

    const percent = (income: number) => `${((income / value) * 100).toFixed(2)}%`;
    const lines = [
        '📊 <b>Weekly summary</b>',
        `💰 Earning ~${usd(now)}/yr (${percent(now)} on average)`,
        ...(best - now >= MIN_GAIN_USD
            ? [`🚀 Up to ~${usd(best)}/yr (${percent(best)}) with every coin at its best rate`]
            : []),
        ...(withRates > 0 ? [`✅ At the best rate already: ${optimal} of ${withRates} coins`] : [])
    ];

    const topMoves = moves.sort((a, b) => b.gainUsd - a.gainUsd).slice(0, MAX_MOVES);

    if (topMoves.length > 0) {
        lines.push('', '<b>Best moves</b>');
        topMoves.forEach(({ symbol, place, nowApr, best: target, gainUsd, gainCoins }) => {
            const coins = gainCoins === null ? '' : ` (+${formatCoins(gainCoins)} ${escapeHtml(symbol)})`;
            lines.push(
                `🪙 <b>${escapeHtml(symbol)}</b> · ${escapeHtml(place)} ${nowApr.toFixed(2)}%`
                    + ` → <b>${escapeHtml(target.exchange.name)} ${target.apr.toFixed(2)}%</b> · ${term(target.days)}`,
                `   +${usd(gainUsd)}/yr${coins}`
            );
        });
    }

    const topPromos = promos.sort((a, b) => b.apr - a.apr).slice(0, MAX_PROMOS);

    if (topPromos.length > 0) {
        lines.push('', '<b>🎁 Promos running</b>');
        topPromos.forEach(({ symbol, exchangeName, apr, days }) => lines.push(
            `🪙 ${escapeHtml(symbol)} · ${escapeHtml(exchangeName)} · ${days} ${days === 1 ? 'day' : 'days'}`
                + ` at ${apr.toFixed(2)}%`
        ));
    }

    if (rates.failed.length > 0) {
        lines.push('', `<i>No response from ${rates.failed.map(({ name }) => escapeHtml(name)).join(', ')}</i>`);
    }

    return lines.join('\n');
}

/** The latest moment the summary was due: the digest day at DIGEST_HOUR, this week or the last. */
export function lastDigestSlot(now: Date, day: number): number {
    const slot = new Date(now);
    slot.setHours(DIGEST_HOUR, 0, 0, 0);
    slot.setDate(slot.getDate() - ((slot.getDay() - day + 7) % 7));

    if (slot > now) {
        slot.setDate(slot.getDate() - 7);
    }

    return slot.getTime();
}

export async function isDigestDue(settings: Settings, now = new Date()): Promise<boolean> {
    if (!settings.weeklyDigest) {
        return false;
    }

    return (await lastDigestItem.getValue() ?? 0) < lastDigestSlot(now, settings.digestDay);
}

/** Builds and sends the summary; resolves to whether there was anything to send. Throws if Telegram fails. */
export async function sendDigest(settings: Settings, rates: LoadedRates): Promise<boolean> {
    const text = buildDigest({ rates, holdings: await holdingsItem.getValue(), settings });

    if (!text) {
        return false;
    }

    await sendMessage(settings.botToken, settings.chatId, text);
    await lastDigestItem.setValue(Date.now());
    return true;
}
