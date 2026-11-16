// What the portfolio earns a year now vs at the best rates, and the moves that would close the gap.
// Shared by the weekly Telegram summary and the totals banner, so both show the same numbers.

import {
    bestIncomeRate, currentApr, estimateIncome, type ExchangeResolver, type IncomeRate
} from './holdings';
import type { RatesByCoin } from './rates';

/** Moves that add less than this a year, USD, aren't worth the hassle. */
export const MIN_GAIN_USD = 0.5;

type Position = { portfolio: string; value: number; balance?: number };

export interface Move {
    symbol: string;
    place: string;
    nowApr: number;
    best: IncomeRate;
    gainUsd: number;
    gainCoins: number | null;
}

export interface PortfolioIncome {
    value: number;
    /** USD a year at the current rates. */
    now: number;
    /** USD a year with every coin at its best rate. */
    best: number;
    /** Coins big enough for suggestions that have a rate somewhere, and how many of them are already at the best. */
    withRates: number;
    optimal: number;
    /** Biggest yearly gain first. */
    moves: Move[];
}

export function portfolioIncome(
    holdings: Record<string, Position[]>,
    byCoin: RatesByCoin,
    resolve: ExchangeResolver,
    include: (portfolio: string) => boolean,
    minPositionUsd = 0
): PortfolioIncome {
    const total: PortfolioIncome = { value: 0, now: 0, best: 0, withRates: 0, optimal: 0, moves: [] };

    Object.entries(holdings).forEach(([symbol, all]) => {
        const places = all.filter(({ portfolio }) => include(portfolio));
        const list = byCoin.get(symbol) ?? [];

        if (places.length === 0) {
            return;
        }

        const income = estimateIncome(places, list, resolve);
        total.value += income.value;
        total.now += income.now;
        total.best += income.best;

        // Coins kept just to watch the price count in the totals, but get no suggestions.
        if (income.value < minPositionUsd || !income.bestRate) {
            return;
        }

        total.withRates++;
        const ticker = symbol.toUpperCase();
        const coinMoves = places.flatMap(({ portfolio, value, balance }) => {
            const exchange = resolve(portfolio);
            const nowApr = currentApr(exchange, list, balance);
            const target = bestIncomeRate(list, balance);
            const gainUsd = target ? (value * (target.apr - nowApr)) / 100 : 0;

            if (!target || target.exchange.id === exchange?.id || gainUsd < MIN_GAIN_USD) {
                return [];
            }

            const gainCoins = balance === undefined ? null : (balance * (target.apr - nowApr)) / 100;
            return [{ symbol: ticker, place: exchange?.name ?? portfolio, nowApr, best: target, gainUsd, gainCoins }];
        });

        if (coinMoves.length === 0) {
            total.optimal++;
        }

        total.moves.push(...coinMoves);
    });

    total.moves.sort((a, b) => b.gainUsd - a.gainUsd);
    return total;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** The banner's "Earn / yr" stat: "$7.00 → $15.00 at best" and "3.50% → 7.50%" of the value. */
export function formatIncomeStat(
    { value, now, best }: Pick<PortfolioIncome, 'value' | 'now' | 'best'>,
    hidden: boolean
) {
    const percent = (income: number) => `${(value > 0 ? (income / value) * 100 : 0).toFixed(2)}%`;

    return {
        main: hidden ? '***** → ***** at best' : `${usd.format(now)} → ${usd.format(best)} at best`,
        percent: `${percent(now)} → ${percent(best)}`
    };
}

const MAX_TIP_MOVES = 3;

/** The banner stat's tooltip: "TIA: Bybit → Wallet, +4.1 pp" for the top moves. */
export function formatMovesTip(moves: Move[]): string {
    if (moves.length === 0) {
        return 'Every coin is already at its best rate';
    }

    return ['Best moves:', ...moves.slice(0, MAX_TIP_MOVES).map(({ symbol, place, nowApr, best }) => (
        `${symbol}: ${place} → ${best.exchange.name}, +${(best.apr - nowApr).toFixed(1)} pp`
    ))].join('\n');
}
