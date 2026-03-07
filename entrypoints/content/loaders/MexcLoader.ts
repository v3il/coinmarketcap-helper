import { BasicLoader } from './BasicLoader';

const URL = 'https://www.mexc.com/api/financialactivity/financial/products/list/V2';
const ENDED_STATE = 5;

interface IEarnItem {
    showApr: string;
    fixedInvestPeriodCount: number | null;
    financialType: 'FIXED' | 'FLEXIBLE';
    financialState: number;
    soldOut: boolean;
}

interface IResponse {
    data: {
        currency: string;
        financialProductList: IEarnItem[];
    }[]
}

export class MexcLoader extends BasicLoader {
    async loadEarnData(): Promise<void> {
        try {
            const response = await this.requestSender.sendRequest<IResponse>(URL);
            const { data } = response.data!;

            data.forEach((item) => {
                const items = item.financialProductList
                    .filter((product) => !(product.soldOut || product.financialState === ENDED_STATE))
                    .map((product) => {
                        const duration = product.financialType === 'FIXED' ? product.fixedInvestPeriodCount! : 0;

                        return {
                            value: this.parseEstimateApr(product.showApr),
                            duration: String(duration)
                        };
                    });

                this.store.set(item.currency.toLowerCase(), items);
            });
        } catch (error) {
            console.error('MexcLoader failed to load earn data', error);
        }
    }

    private parseEstimateApr(apr: string): number {
        return Number.parseFloat(apr);
    }
}
