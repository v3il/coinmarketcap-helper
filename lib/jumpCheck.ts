import { withoutExcluded } from './holdings';
import {
    findDrops, findJumps, formatDrops, formatJumps, positionPercent, type Jump, type JumpAlert, type PriceBaseline
} from './jumps';
import { fetchPrices } from './prices';
import { coinIdsItem, priceBaselinesItem, type Settings } from './storage';
import { sendMessage } from './telegram';

type Position = { portfolio: string; value: number; balance?: number; cost?: number };

/** `ok: false` only when a jump or drop message couldn't be sent; a price API failure is just a warning. */
export type JumpCheckResult =
    | { ok: true; jumps: number; drops: number; warning?: string }
    | { ok: false; jumps: number; drops: number; error: string };

/**
 * Compares held coins' prices with the previous check and sends one Telegram message for the jumps, one for the drops.
 * All held coins count, however small (lottery coins are worth a few dollars); unchecked portfolios don't.
 * Baselines always move on, except for coins whose alert didn't get through (retried next time).
 */
export async function runJumpCheck(
    settings: Settings,
    holdings: Record<string, Position[]>,
    now = Date.now()
): Promise<JumpCheckResult> {
    const ids = await coinIdsItem.getValue();
    const allHeld = Object.entries(holdings)
        .map(([symbol, positions]) => [symbol, withoutExcluded(positions, settings.excludedPortfolios)
            .filter(({ value, balance }) => value > 0 || (balance ?? 0) > 0)] as const)
        .filter(([, positions]) => positions.length > 0);
    const held = allHeld.filter(([symbol]) => ids[symbol] !== undefined);

    let byId: Map<number, number>;

    try {
        byId = await fetchPrices(held.map(([symbol]) => ids[symbol]));
    } catch (error) {
        return { ok: true, jumps: 0, drops: 0, warning: `prices failed: ${(error as Error).message}` };
    }

    const prices = new Map(held.flatMap(([symbol]) => {
        const price = byId.get(ids[symbol]);
        return price === undefined ? [] : [[symbol, price] as const];
    }));
    const previous = await priceBaselinesItem.getValue();
    const next: Record<string, PriceBaseline> = {};

    // Coins no longer held drop out; coins without a price (or CMC id) this time keep their old baseline.
    allHeld.forEach(([symbol]) => {
        const price = prices.get(symbol);

        if (price !== undefined) {
            next[symbol] = { price, at: now };
        } else if (previous[symbol]) {
            next[symbol] = previous[symbol];
        }
    });

    const jumps = settings.jumpAlerts ? findJumps(prices, previous, settings.minJumpPercent) : [];
    const drops = settings.dropAlerts ? findDrops(prices, previous, settings.minDropPercent) : [];
    const positionsOf = new Map(held);
    const errors: string[] = [];

    // One message per kind; a message that fails keeps its coins' old baselines, so the next check retries them.
    const send = async (found: Jump[], format: (alerts: JumpAlert[], at: number) => string, what: string) => {
        if (found.length === 0) {
            return;
        }

        const alerts: JumpAlert[] = found.map((jump) => {
            const positions = positionsOf.get(jump.symbol) ?? [];
            return {
                ...jump,
                portfolios: [...new Set(positions.map(({ portfolio }) => portfolio))],
                position: positionPercent(positions, prices.get(jump.symbol)!)
            };
        });

        try {
            await sendMessage(settings.botToken, settings.chatId, format(alerts, now));
        } catch (error) {
            found.forEach(({ symbol }) => {
                next[symbol] = previous[symbol];
            });
            errors.push(`Failed to send price ${what}: ${(error as Error).message}`);
        }
    };

    await send(jumps, formatJumps, 'jumps');
    await send(drops, formatDrops, 'drops');

    const counts = { jumps: jumps.length, drops: drops.length };
    const result: JumpCheckResult = errors.length > 0
        ? { ok: false, ...counts, error: errors.join('; ') }
        : { ok: true, ...counts };

    await priceBaselinesItem.setValue(next);
    return result;
}
