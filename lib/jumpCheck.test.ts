import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { runJumpCheck } from './jumpCheck';
import { fetchPrices } from './prices';
import { coinIdsItem, DEFAULT_SETTINGS, priceBaselinesItem } from './storage';
import { sendMessage } from './telegram';

vi.mock('./prices', () => ({ fetchPrices: vi.fn() }));
vi.mock('./telegram', async (original) => ({ ...await original<object>(), sendMessage: vi.fn() }));

const settings = { ...DEFAULT_SETTINGS, botToken: 't', chatId: 'c', excludedPortfolios: ['Savings'] };
const holdings = {
    xyz: [{ portfolio: 'Trash', value: 3, balance: 100, cost: 1 }],
    abc: [{ portfolio: 'Trash', value: 2, balance: 1 }],
    old: [{ portfolio: 'Savings', value: 5, balance: 1 }]
};

beforeEach(async () => {
    fakeBrowser.reset();
    vi.mocked(sendMessage).mockReset();
    vi.mocked(fetchPrices).mockReset();
    await coinIdsItem.setValue({ xyz: 1, abc: 2, old: 3 });
    await priceBaselinesItem.setValue({ xyz: { price: 0.01, at: 0 }, abc: { price: 2, at: 0 } });
    vi.mocked(fetchPrices).mockResolvedValue(new Map([[1, 0.02], [2, 2.1], [3, 9]]));
});

describe('runJumpCheck', () => {
    it('alerts on a jump, with the position result, and moves the baselines', async () => {
        const result = await runJumpCheck(settings, holdings, 1000);

        expect(result).toEqual({ ok: true, jumps: 1 });
        const text = vi.mocked(sendMessage).mock.calls[0][2];
        expect(text).toContain('XYZ');
        expect(text).toContain('your position +100%');
        expect(await priceBaselinesItem.getValue()).toEqual({
            xyz: { price: 0.02, at: 1000 },
            abc: { price: 2.1, at: 1000 }
        });
    });

    it('leaves unchecked portfolios out (no price asked, no baseline)', async () => {
        await runJumpCheck(settings, holdings, 1000);
        expect(vi.mocked(fetchPrices).mock.calls[0][0].sort()).toEqual([1, 2]);
    });

    it('keeps the old baseline of a jumped coin when Telegram fails, so the next check retries', async () => {
        vi.mocked(sendMessage).mockRejectedValue(new Error('down'));

        const result = await runJumpCheck(settings, holdings, 1000);

        expect(result.ok).toBe(false);
        const baselines = await priceBaselinesItem.getValue();
        expect(baselines.xyz).toEqual({ price: 0.01, at: 0 });
        expect(baselines.abc).toEqual({ price: 2.1, at: 1000 });
    });

    it('changes nothing when prices fail to load', async () => {
        vi.mocked(fetchPrices).mockRejectedValue(new Error('429'));

        expect((await runJumpCheck(settings, holdings, 1000)).ok).toBe(false);
        expect((await priceBaselinesItem.getValue()).xyz).toEqual({ price: 0.01, at: 0 });
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('only moves baselines when alerts are off', async () => {
        await runJumpCheck({ ...settings, jumpAlerts: false }, holdings, 1000);
        expect(sendMessage).not.toHaveBeenCalled();
        expect((await priceBaselinesItem.getValue()).xyz.price).toBe(0.02);
    });
});
