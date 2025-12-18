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
                this.store.set(item.ccy.toLowerCase(), [
                    {
                        value: this.parseEstimateApr(item.estRate),
                        duration: '0'
                    }
                ]);
            });
        } catch (error) {
            console.error('OkxLoader failed to load earn data', error);
        }
    }

    private parseEstimateApr(apr: string): number {
        return Number.parseFloat(apr) * 100;
    }
}
