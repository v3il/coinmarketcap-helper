import { fetchJson } from '@/utils/request';
import { earnProviderLogo, parsePercent, toRates, type Exchange } from './common';

interface Currency {
    investCurrency: { currencyName: string };
    // rateNum.value[0] is a percent string, e.g. "10.000000".
    rate: { rateType: 'SINGLE_RATE' | string; rateNum: { value: string[] } };
}

interface Response {
    data: { allProducts: { currencies: Currency[] } };
}

export const okx: Exchange = {
    id: 'okx',
    name: 'OKX',
    logoUrl: earnProviderLogo(4),

    async loadRates() {
        // The website's own Simple Earn endpoint; `t` is a cache buster.
        const url = `https://www.okx.com/priapi/v1/earn/simple-earn/all-products?type=all&t=${Date.now()}`;
        const { data } = await fetchJson<Response>(url);

        return toRates(data.allProducts.currencies, ({ rate, investCurrency }) => (
            rate.rateType === 'SINGLE_RATE'
                ? [[investCurrency.currencyName, { apr: parsePercent(rate.rateNum.value[0]), days: 0 }]]
                : []
        ));
    }
};
