// CoinMarketCap's own portfolio API, called with the user's session exactly like the CMC page does:
// session cookies (same-site) plus the x-csrf-token header that CMC keeps in a readable cookie.
// Runs in the content script only; nothing from here is sent to the extension's background or anywhere else.

const API = 'https://api.coinmarketcap.com';
const USD_ID = 2781;

export interface PortfolioInfo {
    id: string;
    name: string;
    /** Whether CMC includes this portfolio in the overall total. */
    counted: boolean;
}

export interface PortfolioTotals {
    /** Total spent on buys (USD). */
    invested: number;
    /** Current value (USD). */
    value: number;
    /** All-time profit/loss (USD), realized + unrealized, as CMC computes it. */
    pl: number;
    realized: number;
    unrealized: number;
}

interface ApiResponse<T> {
    data: T;
    status: { error_code: string | number; error_message: string };
}

const csrfToken = () => document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('x-csrf-token='))
    ?.slice('x-csrf-token='.length);

async function post<T>(path: string, body: object): Promise<T> {
    const token = csrfToken();
    const response = await fetch(`${API}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/json',
            platform: 'web',
            ...(token ? { 'x-csrf-token': token } : {})
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error(`CMC ${path}: HTTP ${response.status}`);
    }

    const json = await response.json() as ApiResponse<T>;

    if (String(json.status?.error_code) !== '0') {
        throw new Error(`CMC ${path}: ${json.status?.error_code} ${json.status?.error_message}`);
    }

    return json.data;
}

export async function fetchPortfolios(): Promise<PortfolioInfo[]> {
    const data = await post<{ portfolioSourceId?: string; portfolioName: string; beCounted?: boolean }[]>(
        '/asset/v4/portfolio/group/queryAll',
        { convertCryptoId: USD_ID }
    );

    // The first entry is the "Overview" pseudo-portfolio without an id.
    return data
        .filter((item) => item.portfolioSourceId)
        .map((item) => ({ id: item.portfolioSourceId!, name: item.portfolioName, counted: item.beCounted !== false }));
}

/** Portfolio id -> lower-case symbols of the coins it holds. */
export async function fetchPortfolioCoins(): Promise<Map<string, Set<string>>> {
    const data = await post<{ list: { symbol: string; subItems: { portfolioSourceId: string }[] | null }[] }>(
        '/asset/v3/portfolio/dashboard/query-summary',
        {}
    );
    const coins = new Map<string, Set<string>>();

    data.list.forEach(({ symbol, subItems }) => (subItems ?? []).forEach(({ portfolioSourceId }) => {
        const set = coins.get(portfolioSourceId) ?? new Set<string>();
        set.add(symbol.toLowerCase());
        coins.set(portfolioSourceId, set);
    }));

    return coins;
}

export async function fetchPortfolioTotals(id: string): Promise<PortfolioTotals> {
    const data = await post<Record<string, number | string | null>>(
        '/asset/v3/portfolio/queryStatistics',
        { portfolioSourceId: id, cryptoUnit: USD_ID, fiatUnit: USD_ID }
    );
    const num = (key: string) => Number(data[key] ?? 0) || 0;

    return {
        invested: num('allTotalBuySpent'),
        value: num('currentTotalHoldings'),
        pl: num('totalPlValue'),
        realized: num('realizedProfit'),
        unrealized: num('unrealizedProfit')
    };
}

export function sumTotals(list: PortfolioTotals[]): PortfolioTotals {
    return list.reduce((sum, item) => ({
        invested: sum.invested + item.invested,
        value: sum.value + item.value,
        pl: sum.pl + item.pl,
        realized: sum.realized + item.realized,
        unrealized: sum.unrealized + item.unrealized
    }), { invested: 0, value: 0, pl: 0, realized: 0, unrealized: 0 });
}
