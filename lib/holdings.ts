import { EXCHANGES, type Exchange } from './exchanges';
import type { ExchangeRates } from './rates';

/** A coin's position in one CMC portfolio. */
export interface Holding {
    portfolio: string;
    /** Current value in USD. */
    value: number;
    /** CMC portfolio id and exact coin amount there (on the CMC page only; not needed for alerts). */
    portfolioId?: string;
    balance?: number;
}

/** Lower-case coin symbol -> its positions across portfolios. */
export type HoldingsByCoin = Map<string, Holding[]>;

/** Portfolio name -> exchange id, or NOT_AN_EXCHANGE; set by the user on the settings page. */
export type PortfolioExchanges = Record<string, string>;

/** Settings value for a portfolio that isn't on a supported exchange (wallet, other exchange, savings…). */
export const NOT_AN_EXCHANGE = 'none';

/** Drops positions in portfolios the user unchecked in the settings (not counted in totals, income or alerts). */
export function withoutExcluded<T extends { portfolio: string }>(holdings: T[], excluded: string[] = []): T[] {
    const names = new Set(excluded.map((name) => name.trim().toLowerCase()));
    return holdings.filter(({ portfolio }) => !names.has(portfolio.trim().toLowerCase()));
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Best guess from the portfolio name ("WhiteBit", "Binance Earn" …); null for wallets and anything else. */
export function guessExchange(portfolio: string): Exchange | null {
    const name = normalize(portfolio);
    const matches = (exchange: Exchange) => name.includes(normalize(exchange.id))
        || name.includes(normalize(exchange.name));
    return EXCHANGES.find(matches) ?? null;
}

export type ExchangeResolver = (portfolio: string) => Exchange | null;

/** The user's choice from the settings wins; the name is only a fallback guess. */
export function exchangeResolver(choices: PortfolioExchanges = {}): ExchangeResolver {
    return (portfolio) => {
        const choice = choices[portfolio];

        if (choice === undefined) {
            return guessExchange(portfolio);
        }

        return EXCHANGES.find((exchange) => exchange.id === choice) ?? null;
    };
}

/** Fixed terms up to this many days are short promos (MEXC 2 days at 600%): they don't count as "best". */
export const SHORT_TERM_MAX_DAYS = 14;

/** A short fixed-term offer (1–14 days): a promo, not a rate to keep coins at. */
export const isShortTerm = ({ days }: { days: number }) => days > 0 && days <= SHORT_TERM_MAX_DAYS;

/** Flexible, or fixed for longer than two weeks: a rate you can actually keep coins at. */
export const isRealisticRate = (rate: { days: number }) => !isShortTerm(rate);

export interface IncomeRate {
    apr: number;
    days: number;
    exchange: Exchange;
}

/** The best realistic rate for a coin: flexible, or fixed for longer than two weeks. */
export function bestIncomeRate(list: ExchangeRates[] = []): IncomeRate | null {
    let best: IncomeRate | null = null;

    list.forEach(({ exchange, rates }) => rates.forEach(({ apr, days }) => {
        if (isRealisticRate({ days }) && (!best || apr > best.apr)) {
            best = { apr, days, exchange };
        }
    }));

    return best;
}

/**
 * The rate a position most likely earns now: the best realistic rate of the exchange it sits on (users stake at
 * the best rate their exchange offers, e.g. WhiteBIT 30d when there's no flexible plan).
 * Wallets, unknown places and exchanges without an earn product for the coin count as 0%.
 */
export function currentApr(exchange: Exchange | null, list: ExchangeRates[] = []): number {
    const own = exchange ? list.filter((item) => item.exchange.id === exchange.id) : [];
    return bestIncomeRate(own)?.apr ?? 0;
}

export interface Income {
    value: number;
    /** USD per year at the current rates. */
    now: number;
    /** USD per year if everything earned the best rate. */
    best: number;
    /** The same in coins per year; null when the coin amounts aren't known. */
    nowCoins: number | null;
    bestCoins: number | null;
    bestRate: IncomeRate | null;
}

export function estimateIncome(holdings: Holding[], list: ExchangeRates[], resolve: ExchangeResolver): Income {
    const bestRate = bestIncomeRate(list);
    const aprs = holdings.map((holding) => currentApr(resolve(holding.portfolio), list));
    const value = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const now = holdings.reduce((sum, holding, i) => sum + (holding.value * aprs[i]) / 100, 0);

    const knownAmounts = holdings.every((holding) => holding.balance !== undefined);
    const amount = holdings.reduce((sum, holding) => sum + (holding.balance ?? 0), 0);
    const nowCoins = knownAmounts
        ? holdings.reduce((sum, holding, i) => sum + ((holding.balance ?? 0) * aprs[i]) / 100, 0)
        : null;
    const bestCoins = knownAmounts && nowCoins !== null
        ? Math.max(nowCoins, bestRate ? (amount * bestRate.apr) / 100 : 0)
        : null;

    const best = bestRate ? Math.max(now, (value * bestRate.apr) / 100) : now;

    return { value, now, best, nowCoins, bestCoins, bestRate };
}

/** Coin amounts for income lines: "1,234", "12.35", "0.0421". */
export function formatCoins(amount: number): string {
    if (amount >= 100) return Math.round(amount).toLocaleString('en-US');
    if (amount >= 1) return amount.toFixed(2);
    return amount === 0 ? '0' : amount.toPrecision(3);
}
