import { BasicLoader } from './BasicLoader';

const URL = 'https://api.bybit.com/v5/earn/product?category=FlexibleSaving';

interface IEarnItem {
    coin: string;
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
                this.store.set(item.coin.toLowerCase(), this.parseEstimateApr(item.estimateApr));
            });
        } catch (error) {
            console.error('BybitLoader failed to load earn data', error);
        }
    }

    private parseEstimateApr(apr: string): number {
        return Number.parseFloat(apr.replace('%', ''));
    }
}

// {
//     "category": "FlexibleSaving",
//     "estimateApr": "100%",
//     "coin": "EAT",
//     "minStakeAmount": "1500",
//     "maxStakeAmount": "4000",
//     "precision": "8",
//     "productId": "864",
//     "status": "Available",
//     "bonusEvents": [],
//     "minRedeemAmount": "",
//     "maxRedeemAmount": "",
//     "duration": "",
//     "term": 0,
//     "swapCoin": "",
//     "swapCoinPrecision": "",
//     "stakeExchangeRate": "",
//     "redeemExchangeRate": "",
//     "rewardDistributionType": "",
//     "rewardIntervalMinute": 0,
//     "redeemProcessingMinute": 0,
//     "stakeTime": "",
//     "interestCalculationTime": "",
//     "hasTieredApr": false,
//     "tierAprDetails": [],
//     "remainingPoolAmount": "1475108.89260145"
// }
