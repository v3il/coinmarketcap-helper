import type { Rate } from '../common';

/** One network's native staking rate source. Symbols upper-case; rates net of the validator fee. */
export interface NetworkModule {
    name: string;
    load(): Promise<[string, Rate][]>;
}
