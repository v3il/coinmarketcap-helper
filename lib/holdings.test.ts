import { describe, expect, it } from 'vitest';
import { guessExchange } from './holdings';

const guess = (name: string) => guessExchange(name)?.id ?? null;

describe('guessExchange', () => {
    it.each(['Keplr', 'phantom', 'Leo Wallet', 'Solflare', 'Leap', 'Petra', 'Suiet', 'Sui Wallet', 'Backpack'])(
        'binds the %s wallet to native staking rates',
        (name) => { expect(guess(name)).toBe('wallet'); }
    );

    it('keeps exchanges and Ready first', () => {
        expect(guess('Ready Wallet')).toBe('ready');
        expect(guess('Bybit Earn')).toBe('bybit');
    });

    it('leaves other places without a rate', () => {
        expect(guess('Telegram')).toBeNull();
        expect(guess('Savings')).toBeNull();
        expect(guess('Telegram Wallet')).toBeNull();
    });
});
