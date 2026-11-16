import { afterEach, describe, expect, it } from 'vitest';
import { wallet, WALLET_MODULES, type NetworkModule } from './index';

const original = [...WALLET_MODULES];
const tia = { apr: 4.5, days: 0, unbondingDays: 14, approximate: true };
const ok: NetworkModule = { name: 'ok', load: async () => [['TIA', tia]] };
const down: NetworkModule = { name: 'down', load: async () => { throw new Error('429'); } };

const use = (...modules: NetworkModule[]) => WALLET_MODULES.splice(0, WALLET_MODULES.length, ...modules);

afterEach(() => { use(...original); });

describe('wallet', () => {
    it('is shown as Native staking (the id stays "wallet" for saved settings)', () => {
        expect([wallet.id, wallet.name]).toEqual(['wallet', 'Native staking']);
    });
});

describe('wallet.loadRates', () => {
    it('keeps the rates of the networks that answered when one is down', async () => {
        use(ok, down);
        const rates = await wallet.loadRates();
        expect(rates.get('tia')?.[0].apr).toBe(4.5);
    });

    it('fails only when every network is down', async () => {
        use(down, down);
        await expect(wallet.loadRates()).rejects.toThrow();
    });
});
