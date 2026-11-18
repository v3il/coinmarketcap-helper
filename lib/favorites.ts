// The "To buy" list: coins the owner would like to buy more of, as lower-case symbols.

const normalize = (symbol: string) => symbol.trim().toLowerCase();

/** Adds the coin, or removes it if it's already there; the result is sorted and without duplicates. */
export function toggleFavorite(list: string[], symbol: string): string[] {
    const coins = new Set(list.map(normalize).filter(Boolean));
    const coin = normalize(symbol);

    if (coin) {
        if (coins.has(coin)) {
            coins.delete(coin);
        } else {
            coins.add(coin);
        }
    }

    return [...coins].sort();
}
