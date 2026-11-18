import { describe, expect, it } from 'vitest';
import { toggleFavorite } from './favorites';

describe('toggleFavorite', () => {
    it('adds a coin by its lower-case symbol', () => {
        expect(toggleFavorite([], 'ZRO')).toEqual(['zro']);
    });

    it('removes a coin already in the list, whatever the case and spaces', () => {
        expect(toggleFavorite(['zro'], ' zro ')).toEqual([]);
    });

    it('keeps the list sorted', () => {
        expect(toggleFavorite(['sui'], 'apt')).toEqual(['apt', 'sui']);
    });

    it('ignores an empty symbol and cleans up the list', () => {
        expect(toggleFavorite(['SUI', 'sui'], '')).toEqual(['sui']);
    });
});
