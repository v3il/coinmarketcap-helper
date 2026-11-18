import { EXCHANGES, type Exchange } from './exchanges';

// Logos instead of CMC's portfolio avatars (a few presets, so most portfolios look the same): the exchange a
// portfolio is bound to, a known wallet by its name, or a generic wallet icon.

const GENERIC_WALLET_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
    + '<rect width="40" height="40" rx="8" fill="#2b2f3a"/>'
    + '<rect x="9" y="13" width="22" height="16" rx="3" fill="none" stroke="#a6b0c3" stroke-width="2"/>'
    + '<path d="M12 13l12-4 2 4" fill="none" stroke="#a6b0c3" stroke-width="2" stroke-linejoin="round"/>'
    + '<circle cx="26" cy="21" r="1.8" fill="#a6b0c3"/></svg>';

export const GENERIC_WALLET_ICON = `data:image/svg+xml,${encodeURIComponent(GENERIC_WALLET_SVG)}`;

/** Name fragment -> bundled logo (public/wallets/). */
const WALLET_LOGOS: [string, string][] = [
    ['phantom', 'wallets/phantom.svg'],
    ['keplr', 'wallets/keplr.png'],
    ['leo', 'wallets/leo.png'],
    ['telegram', 'wallets/telegram.png']
];

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** `asset` turns a bundled path into a URL the page can load (browser.runtime.getURL). */
export function portfolioIcon(name: string, exchange: Exchange | null, asset: (path: string) => string): string {
    if (exchange && exchange.id !== 'wallet') {
        return exchange.logoUrl;
    }

    const key = normalize(name);
    const wallet = WALLET_LOGOS.find(([fragment]) => key.includes(fragment));

    if (wallet) {
        return asset(wallet[1]);
    }

    const ready = EXCHANGES.find(({ id }) => id === 'ready');

    if (ready && key.includes('ready')) {
        return ready.logoUrl;
    }

    return GENERIC_WALLET_ICON;
}
