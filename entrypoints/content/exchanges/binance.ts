import { fetchJson } from '@/utils/request';
import { earnProviderLogo, parseFraction, toRates, type Exchange } from './common';

const PAGE_SIZE = 100;
const PRODUCT_TYPES = ['LENDING_FLEXIBLE', 'POS_FIXED'];
const MAX_TERM_DAYS = 60;

interface Item {
    asset: string;
    // duration is "0" for flexible products, otherwise the lock-up term in days.
    productDetailList: { apy: string; duration: string; productType: string }[];
}

interface Response {
    data: { total: string; list: Item[] };
}

const pageUrl = (page: number) => {
    const params = new URLSearchParams({
        includeBFUSD: 'true',
        requestSource: 'WEB',
        pageIndex: String(page),
        pageSize: String(PAGE_SIZE),
        includeEthStaking: 'true',
        includeSolStaking: 'true',
        includeP2pLoan: 'true',
        includeP2pLoanSupply: 'true',
        includeRWUSD: 'true',
        simpleEarnType: 'ALL'
    });

    return `https://www.binance.com/bapi/earn/v1/friendly/finance-earn/simple-earn/homepage/details?${params}`;
};

export const binance: Exchange = {
    id: 'binance',
    name: 'Binance',
    logoUrl: earnProviderLogo(3),

    async loadRates() {
        const items: Item[] = [];

        for (let page = 1; ; page++) {
            const { data } = await fetchJson<Response>(pageUrl(page));
            items.push(...data.list);

            if (data.list.length < PAGE_SIZE || items.length >= Number(data.total)) {
                break;
            }
        }

        return toRates(items, (item) => item.productDetailList
            .filter((detail) => PRODUCT_TYPES.includes(detail.productType) && Number(detail.duration) <= MAX_TERM_DAYS)
            .map((detail) => [item.asset, { apr: parseFraction(detail.apy), days: Number(detail.duration) }]));
    }
};
