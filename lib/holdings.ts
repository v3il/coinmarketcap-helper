import { EXCHANGES, type Exchange } from './exchanges';
import type { ExchangeRates } from './rates';

/** A coin's position in one CMC portfolio. */
export interface Holding {
    portfolio: string;
    /** Current value in USD. */
    value: number;
}

/** Lower-case coin symbol -> its positions across portfolios. */
export type HoldingsByCoin = Map<string, Holding[]>;

/** Portfolio name -> exchange id, or NOT_AN_EXCHANGE; set by the user on the settings page. */
export type PortfolioExchanges = Record<string, string>;

/** Settings value for a portfolio that isn't on a supported exchange (wallet, other exchange, savings…). */
export const NOT_AN_EXCHANGE = 'none';

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

/** Fixed terms shorter than this are usually promos (MEXC 1–2 days at 600%), so they don't count as "best". */
const MIN_FIXED_DAYS_FOR_INCOME = 7;

export interface IncomeRate {
    apr: number;
    days: number;
    exchange: Exchange;
}

/** The best realistic rate for a coin: flexible, or fixed for at least a week. */
export function bestIncomeRate(list: ExchangeRates[] = []): IncomeRate | null {
    let best: IncomeRate | null = null;

    list.forEach(({ exchange, rates }) => rates.forEach(({ apr, days }) => {
        if ((days === 0 || days >= MIN_FIXED_DAYS_FOR_INCOME) && (!best || apr > best.apr)) {
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
    bestRate: IncomeRate | null;
}

export function estimateIncome(holdings: Holding[], list: ExchangeRates[], resolve: ExchangeResolver): Income {
    const bestRate = bestIncomeRate(list);
    const value = holdings.reduce((sum, holding) => sum + holding.value, 0);
    const now = holdings.reduce(
        (sum, holding) => sum + (holding.value * currentApr(resolve(holding.portfolio), list)) / 100,
        0
    );

    return { value, now, best: bestRate ? Math.max(now, (value * bestRate.apr) / 100) : now, bestRate };
}
