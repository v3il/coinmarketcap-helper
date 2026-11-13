import type { HoldingsByCoin } from '@/lib/holdings';

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
    /** Total spent on buys (USD), as CMC reports it ("cost basis"): includes money reinvested through swaps. */
    invested: number;
    /** Current value (USD). */
    value: number;
    /** All-time profit/loss (USD), realized + unrealized, as CMC computes it. */
    pl: number;
}

interface ApiResponse<T> {
    data: T;
    status: { error_code: string | number; error_message: string };
}

const csrfToken = () => document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('x-csrf-token='))
    ?.slice('x-csrf-token='.length);

/** CMC's answer when the CSRF token is missing or stale ("For security reason, this request has been rejected"). */
const SECURITY_REJECTED = '40110';
const ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function post<T>(path: string, body: object): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        // Re-read the token on every attempt: CMC refreshes it (notably right after page load).
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
        const json = await response.json().catch(() => null) as ApiResponse<T> | null;
        const code = String(json?.status?.error_code ?? response.status);

        if (response.ok && code === '0') {
            return json!.data;
        }

        const retriable = code === SECURITY_REJECTED || response.status === 403;

        if (!retriable || attempt >= ATTEMPTS) {
            throw new Error(`CMC ${path}: ${code} ${json?.status?.error_message ?? `HTTP ${response.status}`}`);
        }

        await sleep(1000 * attempt);
    }
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

export interface CoinInfo {
    /** CMC cryptocurrency id. */
    id: number;
    /** Current price in USD. */
    price: number;
}

export interface PortfolioSnapshot {
    /** Lower-case symbol -> positions (portfolio, value, exact amount). */
    holdings: HoldingsByCoin;
    /** Lower-case symbol -> CMC id and price. */
    coins: Map<string, CoinInfo>;
}

/** Every coin across all portfolios: where it's held, how much, and its current price. */
export async function fetchPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    type SubItem = {
        portfolioName: string; portfolioSourceId: string; value: number | string; balance: number | string
    };
    type Item = { symbol: string; cryptocurrencyId: number; currentPrice: number | string; subItems: SubItem[] | null };
    const data = await post<{ list: Item[] }>('/asset/v3/portfolio/dashboard/query-summary', {});
    const holdings: HoldingsByCoin = new Map();
    const coins = new Map<string, CoinInfo>();

    data.list.forEach(({ symbol, cryptocurrencyId, currentPrice, subItems }) => {
        const key = symbol.toLowerCase();
        coins.set(key, { id: cryptocurrencyId, price: Number(currentPrice) || 0 });

        const places = (subItems ?? [])
            .map((item) => ({
                portfolio: item.portfolioName,
                portfolioId: item.portfolioSourceId,
                value: Number(item.value) || 0,
                balance: Number(item.balance) || 0
            }))
            .filter((place) => place.balance > 0 || place.value > 0);

        if (places.length > 0) {
            holdings.set(key, places);
        }
    });

    return { holdings, coins };
}

export interface NewTransaction {
    type: 'buy' | 'sell';
    portfolioId: string;
    coinId: number;
    amount: string;
    price: string;
    note?: string;
}

/** Adds a buy/sell transaction to a portfolio, like CMC's own "Add Transaction" dialog (no fee). */
export async function addTransaction(tx: NewTransaction): Promise<void> {
    await post('/asset/v3/portfolio/add', {
        transactionType: tx.type,
        cryptocurrencyId: tx.coinId,
        cryptoUnit: USD_ID,
        fiatUnit: USD_ID,
        portfolioSourceId: tx.portfolioId,
        amount: tx.amount,
        price: tx.price,
        transactionTime: new Date().toISOString(),
        fee: '',
        note: tx.note ?? ''
    });
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
        pl: num('totalPlValue')
    };
}

export function sumTotals(list: PortfolioTotals[]): PortfolioTotals {
    return list.reduce((sum, item) => ({
        invested: sum.invested + item.invested,
        value: sum.value + item.value,
        pl: sum.pl + item.pl
    }), { invested: 0, value: 0, pl: 0 });
}
