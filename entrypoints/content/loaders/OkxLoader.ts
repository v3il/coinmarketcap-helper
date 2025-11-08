import { BasicLoader } from './BasicLoader';

const URL = 'https://www.okx.com/api/v5/finance/savings/lending-rate-summary';

interface IEarnItem {
    ccy: string;
    estRate: string;
}

interface IResponse {
    data: IEarnItem[]
}

export class OkxLoader extends BasicLoader {
    async loadEarnData(): Promise<void> {
        try {
            const response = await this.requestSender.sendRequest<IResponse>(URL);
            const { data } = response.data!;

            data.forEach((item) => {
                this.store.set(item.ccy.toLowerCase(), this.parseEstimateApr(item.estRate));
            });
        } catch (error) {
            console.error('OkxLoader failed to load earn data', error);
        }
    }

    private parseEstimateApr(apr: string): number {
        return Number.parseFloat(apr) * 100;
    }
}

// {
//     "avgAmt": "",
//     "avgAmtUsd": "",
//     "avgRate": "0.01",
//     "ccy": "BTC",
//     "estRate": "0.01",
//     "preRate": "0.01"
// }
