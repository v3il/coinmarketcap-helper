import { fetchJson } from '@/utils/request';
import { parseFraction, toRates, type Exchange, type Rate } from './common';

// Internal API behind whitebit.com/earn (no auth). Rates are fractions, periods are in minutes.
const API = 'https://internal.whitebit.com/v2/smart';
const MINUTES_PER_DAY = 1440;
const MAX_TERM_DAYS = 60;
// Fixed-term rates need one request per coin; keep the burst small.
const CONCURRENCY = 6;

interface FlexResponse {
    // Keyed by ticker. Flexible plans have a single rate (no tiers).
    data: Record<string, { ticker: string; maxRate: string }>;
}

interface FixedSummaryResponse {
    // Keyed by ticker; maxRate here is for the longest term, so per-term rates come from /detail.
    data: Record<string, { ticker: string; minPeriod: number }>;
}

interface FixedDetailResponse {
    // `rate` is the base (lowest amount band) rate for this term.
    data: { period: number; rate: string; canInvest: boolean }[];
}

async function loadFlexible(): Promise<[string, Rate][]> {
    const { data } = await fetchJson<FlexResponse>(`${API}/flex-plans`);
    return Object.values(data).map((plan) => [plan.ticker, { apr: parseFraction(plan.maxRate), days: 0 }]);
}

async function loadFixedForTicker(ticker: string): Promise<[string, Rate][]> {
    const { data } = await fetchJson<FixedDetailResponse>(`${API}/fixed-plans/${encodeURIComponent(ticker)}/detail`);

    return data
        .map((plan) => ({ ...plan, days: plan.period / MINUTES_PER_DAY }))
        .filter((plan) => plan.canInvest && plan.days <= MAX_TERM_DAYS)
        .map((plan) => [ticker, { apr: parseFraction(plan.rate), days: plan.days }]);
}

async function loadFixed(): Promise<[string, Rate][]> {
    const { data } = await fetchJson<FixedSummaryResponse>(`${API}/fixed-plans`);
    const queue = Object.values(data)
        .filter((plan) => plan.minPeriod / MINUTES_PER_DAY <= MAX_TERM_DAYS)
        .map((plan) => plan.ticker);
    const entries: [string, Rate][] = [];

    const worker = async () => {
        for (let ticker = queue.shift(); ticker; ticker = queue.shift()) {
            try {
                entries.push(...await loadFixedForTicker(ticker));
            } catch (error) {
                console.warn(`[cmc-helper] WhiteBIT: failed to load fixed plans for ${ticker}`, error);
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    return entries;
}

export const whitebit: Exchange = {
    id: 'whitebit',
    name: 'WhiteBIT',
    // WhiteBIT isn't among CMC's earn providers, so use its CMC exchange logo.
    logoUrl: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/501.png',

    async loadRates() {
        const [flexible, fixed] = await Promise.allSettled([loadFlexible(), loadFixed()]);

        if (flexible.status === 'rejected' && fixed.status === 'rejected') {
            throw flexible.reason;
        }

        [flexible, fixed].forEach((result) => {
            if (result.status === 'rejected') {
                console.warn('[cmc-helper] WhiteBIT: partial load failure', result.reason);
            }
        });

        const entries = [flexible, fixed].flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
        return toRates(entries, (entry) => [entry]);
    }
};
