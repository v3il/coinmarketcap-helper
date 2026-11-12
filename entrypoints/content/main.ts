import { EXCHANGES } from './exchanges';
import { loadRates, type RatesByCoin } from './rates';
import { hasPortfolioTable, renderEarnColumn } from './render';
import './styles.css';

const isPortfolioPage = () => window.location.pathname.startsWith('/portfolio-tracker');

export function main() {
    // CoinMarketCap is an SPA, so the script runs on every page and loads rates lazily,
    // the first time a portfolio table shows up (or right away on a direct portfolio visit).
    let rates: Promise<RatesByCoin> | undefined = isPortfolioPage() ? loadRates(EXCHANGES) : undefined;
    let scheduled = false;

    const update = async () => {
        scheduled = false;

        if (!hasPortfolioTable()) {
            return;
        }

        rates ??= loadRates(EXCHANGES);
        renderEarnColumn(await rates);
    };

    const scheduleUpdate = () => {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(update);
        }
    };

    // Our own insertions also trigger the observer; renderEarnColumn is idempotent, so that's a no-op.
    new MutationObserver(scheduleUpdate).observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true
    });

    scheduleUpdate();
}
