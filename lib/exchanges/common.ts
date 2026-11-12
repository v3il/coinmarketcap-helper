export interface Rate {
    /** APR in percent. */
    apr: number;
    /** Lock-up term in days; 0 means flexible (redeem any time). */
    days: number;
}

/** Lower-case coin symbol -> available rates, flexible first, then by term. */
export type CoinRates = Map<string, Rate[]>;

export interface Exchange {
    id: string;
    name: string;
    logoUrl: string;
    loadRates(): Promise<CoinRates>;
}

export const earnProviderLogo = (id: number) => (
    `https://s2.coinmarketcap.com/static/img/earn-provider/64x64/${id}.png`
);

/** "3.5%" or "3.5" -> 3.5 */
export const parsePercent = (value: string) => Number.parseFloat(value.replace('%', ''));

/** "0.035" -> 3.5 */
export const parseFraction = (value: string) => Number.parseFloat(value) * 100;

/**
 * Builds CoinRates from raw API items. `pick` maps an item to [symbol, rate] pairs (empty to skip it).
 * Non-positive and unparsable rates are dropped; duplicate terms for a coin keep the highest rate.
 */
export function toRates<T>(items: T[], pick: (item: T) => [string, Rate][]): CoinRates {
    const byCoin = new Map<string, Map<number, number>>();

    items.flatMap(pick).forEach(([symbol, { apr, days }]) => {
        if (!Number.isFinite(apr) || apr <= 0 || !Number.isFinite(days)) {
            return;
        }

        const key = symbol.toLowerCase();
        const terms = byCoin.get(key) ?? new Map<number, number>();

        terms.set(days, Math.max(apr, terms.get(days) ?? 0));
        byCoin.set(key, terms);
    });

    const rates: CoinRates = new Map();

    byCoin.forEach((terms, symbol) => {
        const list = [...terms].map(([days, apr]) => ({ apr, days })).sort((a, b) => a.days - b.days);
        rates.set(symbol, list);
    });

    return rates;
}
