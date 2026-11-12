import { fetchJson } from '@/utils/request';
import { earnProviderLogo, parsePercent, toRates, type Exchange } from './common';

const ENDED_STATE = 5;

interface Product {
    showApr: string;
    fixedInvestPeriodCount: number | null;
    financialType: 'FIXED' | 'FLEXIBLE';
    financialState: number;
    soldOut: boolean;
}

interface Response {
    data: { currency: string; financialProductList: Product[] }[];
}

const URL = 'https://www.mexc.com/api/financialactivity/financial/products/list/V2';

const termDays = (product: Product) => (product.financialType === 'FIXED' ? product.fixedInvestPeriodCount : 0);

const isAvailable = (product: Product) => (
    !product.soldOut && product.financialState !== ENDED_STATE && termDays(product) !== null
);

export const mexc: Exchange = {
    id: 'mexc',
    name: 'MEXC',
    logoUrl: earnProviderLogo(15),

    async loadRates() {
        const { data } = await fetchJson<Response>(URL);

        return toRates(data, (item) => item.financialProductList
            .filter(isAvailable)
            .map((product) => [item.currency, { apr: parsePercent(product.showApr), days: termDays(product)! }]));
    }
};
