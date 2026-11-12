import { fetchJson } from '@/utils/request';
import { earnProviderLogo, parsePercent, toRates, type Exchange } from './common';

interface Response {
    // Item sample: { coin: "BTC", estimateApr: "1.2%", term: 0, category: "FlexibleSaving", status: "Available", ... }
    result: { list: { coin: string; estimateApr: string; term: number }[] };
}

export const bybit: Exchange = {
    id: 'bybit',
    name: 'Bybit',
    logoUrl: earnProviderLogo(13),

    async loadRates() {
        const { result } = await fetchJson<Response>('https://api.bybit.com/v5/earn/product?category=FlexibleSaving');
        return toRates(result.list, (item) => [[item.coin, { apr: parsePercent(item.estimateApr), days: item.term }]]);
    }
};
