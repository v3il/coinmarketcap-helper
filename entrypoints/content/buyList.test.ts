import { describe, expect, it } from 'vitest';
import { filterApplied } from './buyList';

describe('filterApplied', () => {
    it('filters only when it is on and this table has marked coins', () => {
        expect(filterApplied(true, 3)).toBe(true);
        expect(filterApplied(false, 3)).toBe(false);
    });

    it('shows the whole table when nothing here is marked, keeping the choice for the next table', () => {
        expect(filterApplied(true, 0)).toBe(false);
    });
});
