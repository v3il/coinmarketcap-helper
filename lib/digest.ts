// Weekly Telegram summary: what the portfolio earns now, what it could earn, and the moves worth making.
// Alerts only fire when a rate goes up; this also catches coins that have been sitting at a poor rate all along.

import {
    bestIncomeRate, exchangeResolver, formatCoins, isShortTerm, withoutExcluded
} from './holdings';
import { MIN_GAIN_USD, portfolioIncome } from './income';
import type { LoadedRates } from './rates';
import { holdingsItem, lastDigestItem, type Settings } from './storage';
import { escapeHtml, sendMessage } from './telegram';

const MAX_MOVES = 5;
const MAX_PROMOS = 5;
/** Local hour of the digest day from which the summary goes out (with the first check after it). */
const DIGEST_HOUR = 9;

export const usd = (value: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: value < 10 ? 2 : 0
}).format(value);

type Position = { portfolio: string; value: number; balance?: number };

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
    const excluded = new Set(settings.excludedPortfolios.map((name) => name.trim().toLowerCase()));
    const {
        value, now, best, withRates, optimal, moves
    } = portfolioIncome(
        holdings,
        rates.byCoin,
        resolve,
        (portfolio) => !excluded.has(portfolio.trim().toLowerCase()),
        settings.minPositionUsd
    );
    const promos: DigestPromo[] = [];

    // Promos for the coins big enough for suggestions.
    Object.entries(holdings).forEach(([symbol, all]) => {
        const places = withoutExcluded(all, settings.excludedPortfolios);
        const list = rates.byCoin.get(symbol) ?? [];
        const coinValue = places.reduce((sum, place) => sum + place.value, 0);

        if (!settings.promoAlerts || places.length === 0 || coinValue < settings.minPositionUsd
            || !bestIncomeRate(list)) {
            return;
        }

        list.forEach(({ exchange, rates: offers }) => offers
            .filter((rate) => isShortTerm(rate) && rate.apr >= settings.minPromoApr)
            .forEach(({ apr, days }) => promos.push({
                symbol: symbol.toUpperCase(), exchangeName: exchange.name, apr, days
            })));
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

    const topMoves = moves.slice(0, MAX_MOVES);

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
