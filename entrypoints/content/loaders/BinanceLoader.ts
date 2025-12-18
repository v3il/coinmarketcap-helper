import { BasicLoader, IEarnEntry } from './BasicLoader';

interface IProductDetails {
    apy: string;
    duration: string;
    productType: string;
}

interface IEarnItem {
    asset: string;
    productDetailList: IProductDetails[];
}

interface IResponseData {
    total: string;
    list: IEarnItem[]
}

interface IResponse {
    data: IResponseData
}

export class BinanceLoader extends BasicLoader {
    async loadEarnData(): Promise<void> {
        let total = 0;
        let list: IEarnItem[] = [];
        let page = 1;

        try {
            const pageData = await this.loadItems(page);

            list = pageData.list;
            total = Number.parseInt(pageData.total, 10);

            while (list.length < total) {
                page++;
                const nextPageData = await this.loadItems(page);

                list = list.concat(nextPageData.list);
            }

            list.forEach((item) => {
                const entries: IEarnEntry[] = [];

                item.productDetailList.forEach((detail) => {
                    if (!['POS_FIXED', 'LENDING_FLEXIBLE'].includes(detail.productType) || +detail.duration > 60) {
                        return;
                    }

                    entries.push({
                        value: this.parseEstimateApr(detail.apy),
                        duration: detail.duration
                    });
                });

                if (entries.length > 0) {
                    this.store.set(item.asset.toLowerCase(), entries);
                }
            });
        } catch (error) {
            console.error('BinanceLoader failed to load earn data', error);
        }
    }

    private async loadItems(page: number): Promise<IResponseData> {
        const url = this.buildUrl(page);
        const response = await this.requestSender.sendRequest<IResponse>(url);

        return response.data!.data;
    }

    private buildUrl(page: number): string {
        // eslint-disable-next-line max-len
        return `https://www.binance.com/bapi/earn/v1/friendly/finance-earn/simple-earn/homepage/details?includeBFUSD=true&requestSource=WEB&pageIndex=${page}&pageSize=100&includeEthStaking=true&includeSolStaking=true&includeP2pLoan=true&includeP2pLoanSupply=true&includeRWUSD=true&simpleEarnType=ALL`;
    }

    private parseEstimateApr(apr: string): number {
        return Number.parseFloat(apr) * 100;
    }
}
