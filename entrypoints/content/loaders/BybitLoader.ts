import { BasicLoader } from './BasicLoader';

const URL = 'https://api.bybit.com/v5/earn/product?category=FlexibleSaving';

interface IEarnItem {
    coin: string;
    term: number;
    estimateApr: string;
}

interface IResponse {
    result: {
        list: IEarnItem[]
    }
}

export class BybitLoader extends BasicLoader {
    async loadEarnData(): Promise<void> {
        try {
            const response = await this.requestSender.sendRequest<IResponse>(URL);
            const { list } = response.data!.result;

            list.forEach((item) => {
                this.store.set(item.coin.toLowerCase(), [
                    {
                        value: this.parseEstimateApr(item.estimateApr),
                        duration: String(item.term)
                    }
                ]);
            });
        } catch (error) {
            console.error('BybitLoader failed to load earn data', error);
        }
    }

    private parseEstimateApr(apr: string): number {
        return Number.parseFloat(apr.replace('%', ''));
    }
}
