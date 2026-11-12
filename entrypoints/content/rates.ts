import type { Exchange, Rate } from './exchanges';

export interface ExchangeRates {
    exchange: Exchange;
    rates: Rate[];
}

/** Lower-case coin symbol -> rates per exchange, best flexible APR first. */
export type RatesByCoin = Map<string, ExchangeRates[]>;

export const flexibleApr = (rates: Rate[]) => rates.find((rate) => rate.days === 0)?.apr ?? 0;

export async function loadRates(exchanges: Exchange[]): Promise<RatesByCoin> {
    const results = await Promise.allSettled(exchanges.map((exchange) => exchange.loadRates()));
    const byCoin: RatesByCoin = new Map();

    results.forEach((result, index) => {
        const exchange = exchanges[index];

        if (result.status === 'rejected') {
            console.error(`[cmc-helper] ${exchange.name}: failed to load rates`, result.reason);
            return;
        }

        result.value.forEach((rates, coin) => {
            const list = byCoin.get(coin) ?? [];
            list.push({ exchange, rates });
            byCoin.set(coin, list);
        });
    });

    byCoin.forEach((list) => list.sort((a, b) => flexibleApr(b.rates) - flexibleApr(a.rates)));

    return byCoin;
}
