import { BasicLoader } from './BasicLoader';

const URL = 'https://www.okx.com/priapi/v1/earn/simple-earn/all-products?type=all&t=';

interface IEarnItem {
    ccy: string;
    estRate: string;
}

interface IRate {
    rateNum: {
        value: string[],
        type: string
    },
    rateType: 'SINGLE_RATE' | string;
}

interface ICurrency {
    currencyName: string
}

interface IResponse {
    data: {
        allProducts: {
            currencies: {
                rate: IRate,
                investCurrency: ICurrency
            }[];
        }
    }
}

export class OkxLoader extends BasicLoader {
    async loadEarnData(): Promise<void> {
        try {
            const response = await this.requestSender.sendRequest<IResponse>(URL + Date.now());
            const { data } = response.data!;
            const simpleEarnItems = data.allProducts.currencies.filter((c) => c.rate.rateType === 'SINGLE_RATE');

            simpleEarnItems.forEach((item) => {
                this.store.set(item.investCurrency.currencyName.toLowerCase(), [
                    {
                        value: this.parseEstimateApr(item.rate.rateNum.value[0]),
                        duration: '0'
                    }
                ]);
            });
        } catch (error) {
            console.error('OkxLoader failed to load earn data', error);
        }
    }

    private parseEstimateApr(apr: string): number {
        return Number.parseFloat(apr);
    }
}
