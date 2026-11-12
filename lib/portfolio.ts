import { portfolioItem } from './storage';

/** Coins not seen in the portfolio for this long stop being tracked. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const prune = (seen: Record<string, number>, now: number) => Object.fromEntries(
    Object.entries(seen).filter(([, lastSeen]) => now - lastSeen < RETENTION_MS)
);

export async function rememberPortfolioSymbols(symbols: string[]) {
    const now = Date.now();
    const seen = prune(await portfolioItem.getValue(), now);

    symbols.forEach((symbol) => {
        seen[symbol.toLowerCase()] = now;
    });

    await portfolioItem.setValue(seen);
}

export async function getPortfolioSymbols(): Promise<string[]> {
    return Object.keys(prune(await portfolioItem.getValue(), Date.now())).sort();
}
