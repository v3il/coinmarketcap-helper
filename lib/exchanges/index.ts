import { binance } from './binance';
import { bybit } from './bybit';
import { mexc } from './mexc';
import { okx } from './okx';
import { ready } from './ready';
import { whitebit } from './whitebit';
import type { Exchange } from './common';

export type { Exchange, Rate } from './common';

/** To add an exchange: create a module exporting an `Exchange` and list it here. */
export const EXCHANGES: Exchange[] = [binance, bybit, okx, mexc, whitebit, ready];
