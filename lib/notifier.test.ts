import { describe, expect, it } from 'vitest';
import { describeRate } from './notifier';

describe('describeRate', () => {
    it('marks network staking rates as approximate', () => {
        const rate = {
            apr: 4.7,
            days: 0,
            unbondingDays: 14,
            approximate: true,
            exchangeId: 'wallet',
            exchangeName: 'Native staking'
        };
        expect(describeRate(rate))
            .toBe('≈4.70% · Native staking · flexible, 14-day withdrawal');
    });

    it('leaves exchange rates exact', () => {
        expect(describeRate({ apr: 7.37, days: 0, exchangeId: 'binance', exchangeName: 'Binance' }))
            .toBe('7.37% · Binance · flexible');
    });
});
