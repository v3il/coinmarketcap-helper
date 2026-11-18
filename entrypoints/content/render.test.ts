import { describe, expect, it } from 'vitest';
import { tipContent } from './render';

describe('tipContent', () => {
    it('marks network staking rates as approximate and explains why', () => {
        const { text, title } = tipContent({ apr: 4.7, days: 0, unbondingDays: 14, approximate: true });
        expect(text).toBe('∞: ≈4.70%');
        expect(title).toContain('withdrawal takes 14 days');
        expect(title).toContain('after a typical 10% validator fee');
    });

    it('adds the rate note to the tooltip', () => {
        const { title } = tipContent({ apr: 49, days: 0, approximate: true, note: 'Few stakers' });
        expect(title).toContain('Few stakers');
    });

    it('leaves exact exchange rates as they were', () => {
        expect(tipContent({ apr: 3, days: 30 })).toEqual({ text: '30d: 3.00%', title: '' });
    });
});
