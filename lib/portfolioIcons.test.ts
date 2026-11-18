import { describe, expect, it } from 'vitest';
import { EXCHANGES } from './exchanges';
import { GENERIC_WALLET_ICON, portfolioIcon } from './portfolioIcons';

const byId = (id: string) => EXCHANGES.find((exchange) => exchange.id === id)!;
const binance = byId('binance');
const nativeStaking = byId('wallet');
const ready = byId('ready');
const asset = (path: string) => `ext://${path}`;

describe('portfolioIcon', () => {
    it('uses the logo of the exchange the portfolio is bound to', () => {
        expect(portfolioIcon('Binance', binance, asset)).toBe(binance.logoUrl);
    });

    it('uses the wallet logo for known wallets, bound to native staking or not', () => {
        expect(portfolioIcon('Phantom', nativeStaking, asset)).toBe('ext://wallets/phantom.svg');
        expect(portfolioIcon('Keplr', null, asset)).toBe('ext://wallets/keplr.png');
        expect(portfolioIcon('Leo Wallet', nativeStaking, asset)).toBe('ext://wallets/leo.png');
        expect(portfolioIcon('Telegram', null, asset)).toBe('ext://wallets/telegram.png');
        expect(portfolioIcon('Ready Wallet', null, asset)).toBe(ready.logoUrl);
    });

    it('falls back to a generic wallet icon', () => {
        expect(portfolioIcon('Trash', null, asset)).toBe(GENERIC_WALLET_ICON);
        expect(portfolioIcon('Earn', nativeStaking, asset)).toBe(GENERIC_WALLET_ICON);
    });
});
