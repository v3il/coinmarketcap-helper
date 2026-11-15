import {
    EXCHANGES, type CoinRates, type Exchange, type Rate
} from './exchanges';

export interface ExchangeRates {
    exchange: Exchange;
    rates: Rate[];
}

/** Lower-case coin symbol -> rates per exchange, best APR (flexible or fixed) first. */
export type RatesByCoin = Map<string, ExchangeRates[]>;

export interface LoadedRates {
    byCoin: RatesByCoin;
    /** Exchanges whose rates failed to load this time. */
    failed: Exchange[];
}

export const flexibleApr = (rates: Rate[]) => rates.find((rate) => rate.days === 0)?.apr ?? 0;

const bestApr = (rates: Rate[]) => Math.max(0, ...rates.map((rate) => rate.apr));

/** Groups per-exchange rates by coin, best exchange first. */
export function groupByCoin(loaded: { exchange: Exchange; coins: CoinRates }[]): RatesByCoin {
    const byCoin: RatesByCoin = new Map();

    loaded.forEach(({ exchange, coins }) => coins.forEach((rates, coin) => {
        const list = byCoin.get(coin) ?? [];
        list.push({ exchange, rates });
        byCoin.set(coin, list);
    }));

    byCoin.forEach((list) => list.sort((a, b) => (
        bestApr(b.rates) - bestApr(a.rates) || flexibleApr(b.rates) - flexibleApr(a.rates)
    )));

    return byCoin;
}

/** Wire format for the content script (Maps don't survive messaging): exchange id -> coin -> rates. */
export interface SerializedRates {
    loaded: { id: string; coins: Record<string, Rate[]> }[];
    failed: string[];
}

export function deserializeRates({ loaded, failed }: SerializedRates): LoadedRates {
    const byId = (id: string) => EXCHANGES.find((exchange) => exchange.id === id);

    return {
        byCoin: groupByCoin(loaded.flatMap(({ id, coins }) => {
            const exchange = byId(id);
            return exchange ? [{ exchange, coins: new Map(Object.entries(coins)) }] : [];
        })),
        failed: failed.map(byId).filter((exchange): exchange is Exchange => !!exchange)
    };
}
