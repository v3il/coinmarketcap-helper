export enum Exchange {
    BINANCE = 'binance',
    BYBIT = 'bybit',
    OKX = 'okx',
    MEXC = 'mexc'
}

export const getExchangeLogoId = (exchangeId: Exchange): string => ({
    [Exchange.BINANCE]: '3',
    [Exchange.BYBIT]: '13',
    [Exchange.OKX]: '4',
    [Exchange.MEXC]: '15'
}[exchangeId]);
