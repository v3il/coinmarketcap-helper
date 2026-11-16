import { toRates, type Exchange, type Rate } from '../common';
import { aptos } from './aptos';
import { cosmos } from './cosmos';
import { solana } from './solana';
import type { NetworkModule } from './types';

export type { NetworkModule } from './types';

// Native staking with the network itself (Keplr, Phantom, Leo… only delegate to a validator), so the rate belongs
// to the coin's network, not to a wallet. Shown for every coin that has one, wherever it's held.
export const WALLET_MODULES: NetworkModule[] = [cosmos, solana, aptos];

const LOGO_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#3861fb"/>'
    + '<path d="M6 8.5A1.5 1.5 0 0 1 7.5 7H16v2H7.5a.5.5 0 0 0 0 1H18v7H7.5A1.5 1.5 0 0 1 6 15.5z" fill="#fff"/>'
    + '<circle cx="15" cy="13.5" r="1" fill="#3861fb"/></svg>'
);
const LOGO = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

export const wallet: Exchange = {
    id: 'wallet',
    name: 'Wallet',
    logoUrl: LOGO,

    async loadRates() {
        const results = await Promise.allSettled(WALLET_MODULES.map((module) => module.load()));
        const loaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));

        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                console.warn(`[cmc-helper] Wallet: ${WALLET_MODULES[i].name} rates failed`, result.reason);
            }
        });

        if (loaded.length === 0) {
            throw new Error('No network answered');
        }

        return toRates<[string, Rate]>(loaded.flat(), (pair) => [pair]);
    }
};
