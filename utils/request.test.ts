import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDirect } from './request';

afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchDirect', () => {
    it('gives up on a request that hangs instead of stalling the whole check', async () => {
        vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('timed out')));
        })));

        const result = await fetchDirect('https://example.com', undefined, 20);

        expect(result).toEqual({ ok: false, error: 'timed out (https://example.com)' });
    });
});
