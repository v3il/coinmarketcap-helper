import { RequestSender } from '../RequestSender';

interface IOptions {
    requestSender: RequestSender;
}

export interface IEarnEntry {
    duration: string;
    value: number;
}

export abstract class BasicLoader {
    protected readonly requestSender: RequestSender;
    protected store = new Map<string, IEarnEntry[]>();

    constructor({ requestSender }: IOptions) {
        this.requestSender = requestSender;
    }

    getCoinApr(coin: string): IEarnEntry[] {
        return this.store.get(coin.toLowerCase()) ?? [];
    }

    abstract loadEarnData(): Promise<void>;
}
