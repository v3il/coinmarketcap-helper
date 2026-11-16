import { describe, expect, it } from 'vitest';
import { aptosApr } from './aptos';

describe('aptosApr', () => {
    it('turns the per-epoch fixed-point rate into a yearly rate after the fee', () => {
        expect(aptosApr(String(0.0001 * 2 ** 64))).toBeCloseTo(39.42, 2);
    });

    it('is 0 for an unparsable value', () => {
        expect(aptosApr('x')).toBe(0);
    });
});
