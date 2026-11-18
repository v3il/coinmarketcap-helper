import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cmcApi', () => ({
    fetchPortfolios: vi.fn(),
    fetchPortfolioSnapshot: vi.fn(),
    fetchPositionCosts: vi.fn()
}));

const api = await import('./cmcApi');
const fetchPortfolios = vi.mocked(api.fetchPortfolios);
const fetchPortfolioSnapshot = vi.mocked(api.fetchPortfolioSnapshot);
const fetchPositionCosts = vi.mocked(api.fetchPositionCosts);

describe('position costs cache', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        vi.clearAllMocks();
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        fetchPortfolios.mockResolvedValue([]);
        fetchPositionCosts.mockResolvedValue(new Map());
        fetchPortfolioSnapshot.mockResolvedValue({ holdings: new Map(), coins: new Map(), portfolioOrder: new Map() });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not retry right away after a failed load', async () => {
        const { loadPositionCosts } = await import('./holdings');
        fetchPortfolios.mockRejectedValue(new Error('429'));

        const first = loadPositionCosts();
        await first;
        const second = loadPositionCosts();

        expect(second).toBe(first);
        expect(fetchPortfolios).toHaveBeenCalledTimes(1);
    });

    it('reloads costs together with fresh holdings, so coins and cost come from the same moment', async () => {
        const { loadHoldings, loadPositionCosts } = await import('./holdings');

        await loadHoldings();
        await loadPositionCosts();
        vi.advanceTimersByTime(3 * 60 * 1000);
        await loadHoldings();
        await loadPositionCosts();

        expect(fetchPortfolios).toHaveBeenCalledTimes(2);
    });
});
