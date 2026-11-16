import { fetchJson } from '@/utils/request';

// The public quote API the CoinMarketCap website itself uses for prices: no key, many coins per request.
const URL = 'https://api.coinmarketcap.com/data-api/v3/cryptocurrency/quote/latest';
const USD_ID = 2781;
const BATCH = 100;

interface Quote {
    id: number;
    quotes?: { price?: number }[];
}

/** CMC coin id -> current USD price. Coins the API returns without a price are left out. */
export async function fetchPrices(ids: number[]): Promise<Map<number, number>> {
    const batches: number[][] = [];

    for (let i = 0; i < ids.length; i += BATCH) {
        batches.push(ids.slice(i, i + BATCH));
    }

    const responses = await Promise.all(batches.map((batch) => (
        fetchJson<{ data?: Quote[] }>(`${URL}?id=${batch.join(',')}&convertId=${USD_ID}`)
    )));
    const prices = new Map<number, number>();

    responses.flatMap(({ data }) => data ?? []).forEach(({ id, quotes }) => {
        const price = quotes?.[0]?.price;

        if (typeof price === 'number' && price > 0) {
            prices.set(id, price);
        }
    });

    return prices;
}
