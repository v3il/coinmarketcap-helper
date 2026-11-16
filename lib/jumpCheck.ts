import { withoutExcluded } from './holdings';
import { findJumps, formatJumps, positionPercent, type JumpAlert, type PriceBaseline } from './jumps';
import { fetchPrices } from './prices';
import { coinIdsItem, priceBaselinesItem, type Settings } from './storage';
import { sendMessage } from './telegram';

type Position = { portfolio: string; value: number; balance?: number; cost?: number };

export type JumpCheckResult = { ok: true; jumps: number } | { ok: false; jumps: number; error: string };

/**
 * Compares held coins' prices with the previous check and sends one Telegram message for the jumps.
 * All held coins count, however small (lottery coins are worth a few dollars); unchecked portfolios don't.
 * Baselines always move on, except for coins whose alert didn't get through (retried next time).
 */
export async function runJumpCheck(
    settings: Settings,
    holdings: Record<string, Position[]>,
    now = Date.now()
): Promise<JumpCheckResult> {
    const ids = await coinIdsItem.getValue();
    const held = Object.entries(holdings)
        .map(([symbol, positions]) => [symbol, withoutExcluded(positions, settings.excludedPortfolios)
            .filter(({ value, balance }) => value > 0 || (balance ?? 0) > 0)] as const)
        .filter(([symbol, positions]) => positions.length > 0 && ids[symbol] !== undefined);

    let byId: Map<number, number>;

    try {
        byId = await fetchPrices(held.map(([symbol]) => ids[symbol]));
    } catch (error) {
        return { ok: false, jumps: 0, error: `Prices failed: ${(error as Error).message}` };
    }

    const prices = new Map(held.flatMap(([symbol]) => {
        const price = byId.get(ids[symbol]);
        return price === undefined ? [] : [[symbol, price] as const];
    }));
    const previous = await priceBaselinesItem.getValue();
    const next: Record<string, PriceBaseline> = {};

    // Coins no longer held drop out; coins without a price this time keep their old baseline.
    held.forEach(([symbol]) => {
        const price = prices.get(symbol);

        if (price !== undefined) {
            next[symbol] = { price, at: now };
        } else if (previous[symbol]) {
            next[symbol] = previous[symbol];
        }
    });

    const jumps = settings.jumpAlerts ? findJumps(prices, previous, settings.minJumpPercent) : [];
    let result: JumpCheckResult = { ok: true, jumps: jumps.length };

    if (jumps.length > 0) {
        const positionsOf = new Map(held);
        const alerts: JumpAlert[] = jumps.map((jump) => {
            const positions = positionsOf.get(jump.symbol) ?? [];
            return {
                ...jump,
                portfolios: [...new Set(positions.map(({ portfolio }) => portfolio))],
                position: positionPercent(positions, prices.get(jump.symbol)!)
            };
        });

        try {
            await sendMessage(settings.botToken, settings.chatId, formatJumps(alerts, now));
        } catch (error) {
            jumps.forEach(({ symbol }) => {
                next[symbol] = previous[symbol];
            });
            const reason = (error as Error).message;
            result = { ok: false, jumps: jumps.length, error: `Failed to send price jumps: ${reason}` };
        }
    }

    await priceBaselinesItem.setValue(next);
    return result;
}
