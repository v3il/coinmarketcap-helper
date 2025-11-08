import { RequestSender } from '../RequestSender';

interface IOptions {
    requestSender: RequestSender;
}

export abstract class BasicLoader {
    protected readonly requestSender: RequestSender;
    protected store: Map<string, number> = new Map<string, number>();

    constructor({ requestSender }: IOptions) {
        this.requestSender = requestSender;
    }

    getCoinApr(coin: string): number {
        return this.store.get(coin.toLowerCase()) ?? 0;
    }

    abstract loadEarnData(): Promise<void>;
}
