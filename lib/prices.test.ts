import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPrices } from './prices';

afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchPrices', () => {
    it('asks for at most 100 coins at a time and maps id to price', async () => {
        const urls: string[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            urls.push(url);
            const ids = new URL(url).searchParams.get('id')!.split(',').map(Number);
            const data = ids.map((id) => ({ id, quotes: [{ price: id / 10 }] }));
            return new Response(JSON.stringify({ data, status: { error_code: '0' } }));
        }));

        const prices = await fetchPrices(Array.from({ length: 150 }, (_, i) => i + 1));

        expect(urls).toHaveLength(2);
        expect(prices.size).toBe(150);
        expect(prices.get(42)).toBe(4.2);
    });

    it('skips coins the API returned without a price', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            data: [{ id: 1, quotes: [] }, { id: 2, quotes: [{ price: 3 }] }]
        }))));

        expect([...(await fetchPrices([1, 2])).keys()]).toEqual([2]);
    });
});
