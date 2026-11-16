# CMC Helper — roadmap

_Updated: 2026-11-16._

## Done

### 1.0.0
- **Earn column:** the best rates per coin across Binance, Bybit, OKX, MEXC, WhiteBIT and Ready wallet.
- **Portfolios bound to exchanges:** a ring around the exchange where the coin sits; each portfolio bound to an exchange or "Wallet / other" in the settings (guessed from the name by default). Data: CMC's `portfolio/dashboard/query-summary` (`entrypoints/content/cmcApi.ts`).
- **Yearly income estimate** under the rates: now vs at the best rate.
- **Totals banner:** Invested / Value / Profit-Loss across portfolios (Invested = Value − P/L; CMC's Cost Basis counts swapped money twice). Portfolios that aren't investments are unchecked in the settings.
- **Set amount** on the Holdings cell, with 🎁 Free for rewards.
- **Telegram alerts** for new best rates, with where the coin sits and what moving it would add.

### 1.1.0 (branch `release_1.1.0`)
- **BingX:** rates read from its Earn page (its own signed request), optional background-tab refresh, amount tiers.
- **Promos:** fixed terms up to 14 days don't count as the best rate and get their own 🎁 alerts.
- **Quieter alerts:** none when the coin already sits on the best exchange, none for coins under $10, unchecked portfolios left out; "📍 Now on" line.
- **Weekly summary** in Telegram: income now vs at the best rates, the top 5 moves, running promos.
- **Rates cache** in the worker: the portfolio page no longer loads every exchange on each visit.
- **Income in coins** instead of USD.

### 1.2.0
- **Native staking** (exchange id `wallet`): rates from the networks (TIA, FET, SAGA via cosmos.directory; SOL, APT, SEI, NIBI, SUI from public nodes), after a typical 10% validator fee, shown as "≈"; staking-wallet portfolios bound to it; a new exchange starts with a silent alert baseline.
- **Price jump alerts:** +30% (configurable) since the previous check for any held coin, with the position's P/L % (from CMC's per-portfolio P/L).
- **Banner:** Earn / yr — income now vs at the best rates, USD and %, best moves in the tooltip; shared with the weekly summary.
- **"📍 Now on"** shows the current rate on each exchange.

## Planned

### 1. Syncing coin amounts with exchanges via an API key (next big feature)

A read-only exchange key in the settings, bound to a portfolio. The worker signs requests (HMAC via WebCrypto) and reads balances: spot + Earn/staking + funding. The content script never sees the keys.

- On CMC next to a coin whose amount on the exchange ≠ the amount in the portfolio: "on the exchange +N / −N" and a **Sync** button that adds a transaction for the difference (like Set amount). Only with confirmation: the "no unapproved transactions" rule.
- **The difference: a buy or a reward?** The exchange only knows the amount. Ideas:
  - choose when syncing: Buy at the current price / 🎁 Free;
  - a hint from the source: growth of an Earn position without deposits = reward; a matching buy or deposit in the exchange's history = buy (the price can be taken from the trade);
  - a decrease: a sale or a withdrawal (a transfer to another portfolio, not a sale).
- Check per exchange whether the API returns Earn positions fully (least certain: MEXC, WhiteBIT; BingX Wealth returns only a USDT total).
- Keys stay local, like the bot token; read-only only. Test with a real read-only key, starting with Binance.

### 2. Fixed-term expiry reminders

The user enters, e.g., "BTC — WhiteBIT 30d, opened 12.11". A day before the term ends, Telegram gets "your plan ends tomorrow, here are the best rates now". The start date will most likely have to be entered manually.

### 3. More native staking rates

Done in 1.2.0 for TIA, FET, SAGA, SOL, APT, SEI, NIBI, SUI (`lib/exchanges/wallet/`). Left:

- **ALEO** (Leo Wallet): block rewards ÷ total stake from `api.explorer.provable.com/v1/mainnet` (`/committee/latest`); ≈7–10%, depends on block fees; native delegation from 10,000 ALEO. Hard.
- **Group 3:** MINA, ROSE, ONE, CFX, ASTR, SUPRA, POL — research sources first.
- **DYDX:** don't show (rewards in USDC from trading fees, a noisy figure).
- **Telegram Wallet Earn:** not possible (internal API behind auth); see item 7.
- **Check** SEI, NIBI, SUI against the numbers Keplr / the Sui wallet show: no keyless explorer API was found to verify them automatically (Mintscan needs a key).

### 4. Delisting alerts (not planned)

Price jumps shipped in 1.2.0. Delisting alerts are dropped for now: exchanges already announce delistings by email and in their apps.

### 5. Ratio trading signals

An alternative to staking whose goal is more coins, not more dollars. The idea: watch the price ratio of two coins. When the coin you hold gets temporarily expensive relative to the other, swap part of it; when the ratio returns to its usual level, swap back.

**Format:** scheduled alerts only, all swaps are manual. No auto-trading and no exchange API keys in the browser. Alerts in plain words, no indicators, e.g.:

> 🔄 OP / ARB. Over the last 3 months 1 OP usually cost ≈X ARB, now it's Y — it's this expensive only on 5% of days. Over 2 years this strategy gave +20% more OP (10 swaps).

#### Backtest (2026-11-13, Binance daily prices since ~02.2024, 0.2% fee per swap)

The scripts (`ratio_backtest.py`, `ratio_onesided.py`, `ratio_btc.py`) are not in the repo; the data is Binance's public `/api/v3/klines`, no keys.

**Holding both coins 50/50** (90-day mean, enter at 2σ, shift to 25/75, back to 50/50 at |z| ≤ 0.5). Result vs simply holding. A/B and B/A give the same numbers here:

| Pair | Result | Swaps |
|---|---|---|
| ZK/STRK | +106% | 29 |
| TIA/SEI | +21% (up to +65% with a 30-day window) | 31 |
| WIF/BONK | +18% | 23 |
| FET/RENDER | +2% | 17 |
| ARB/OP | −21% | 20 |
| SUI/APT | −35% | 24 |

**Holding one coin** (swap 50% when it's expensive, swap back when the ratio normalizes). Result: how much more of that coin you end up with:

| Hold → paired with | More coins | | Hold → paired with | More coins |
|---|---|---|---|---|
| ARB → OP | −25% | | OP → ARB | +20% |
| ZK → STRK | +33% | | STRK → ZK | +85% |
| SUI → APT | −14% | | APT → SUI | +18% |
| TIA → SEI | 0% | | SEI → TIA | +9% |
| FET → RENDER | +20% | | RENDER → FET | +2% |
| WIF → BONK | −16% | | BONK → WIF | +19% |

**Takeaways:**
- **Direction matters:** holding the laggard won (OP, APT, BONK). Holding the leader (ARB, SUI, WIF) meant selling "spikes" that turned out to be the trend continuing, and losing coins.
- **A trend guard** (don't enter if the 90-day mean ratio moved more than 30%) **didn't help**: it barely cut losses and trimmed gains. Leave it out.
- **Swaps:** ~3–8 a year per direction, so doing them by hand is realistic.
- **Caveats:** one history, one set of parameters; "+X% coins" ≠ "+X% in dollars"; every swap may be a taxable event; coins in a fixed term or unbonding can't be swapped quickly.

**BTC adjustment (checked):**
- **Beta to BTC** (daily returns, whole period): ARB 1.35 / OP 1.33, ZK 1.46 / STRK 1.38, SUI 1.39 / APT 1.29, TIA 1.37 / SEI 1.36, FET 1.52 / RENDER 1.56, WIF 1.89 / BONK 1.79. Correlation with BTC 0.53–0.71 for all.
- **A BTC-neutral signal** (`spread = ln(A/B) − (β_A − β_B)·ln(BTC)`, beta over the previous 90 days) **doesn't improve things consistently**: TIA/SEI +9% → +26%, SUI/APT −35% → −30%, ARB/OP −19% → −17%, WIF/BONK +10% → +11%, but ZK/STRK +97% → +84% and FET/RENDER +10% → +2%. Pairs from one sector already have near-equal betas, and the SUI/APT losses are the coin's own trend, not the market. Leave it out of the signal.
- **Where beta helps:** choosing pairs. If the betas differ a lot (e.g. BONK 1.79 vs APT 1.29), warn that in a bull market the first will systematically outrun the second.

**Design:**
- **Main model — "hold both 50/50".** The user holds both coins of a pair (likes both) and is fine ending up skewed towards one if the ratio doesn't come back. The one-coin model is for reference.
- **The skew limit is configurable** (25/75 by default, 40/60 to be careful). The strategy never moves everything into one coin, so the worst case is a skew, not an exit.
- Pairs are set in the settings. The coin you hold comes from the portfolio.
- Next to each direction — backtest stats on Binance history. For directions with a historical loss, don't alert or warn explicitly.
- Prices — Binance daily candles `/api/v3/klines`; checked once a day.

### 6. Swap journal

Swaps are usually tracked in a spreadsheet. A journal in the extension would replace it and hold the state for the signals in item 5: to say "swap back", the extension must know whether the previous signal was acted on and what state the pair is in (50/50 or 25/75).

- **One-click entry** from an alert or the settings page; fields prefilled with current prices, the user corrects amounts to what was actually filled.
- **Result of each round** (A → B → A): "+6.2% TIA vs doing nothing", plus a total per pair.
- **CSV import** from an existing spreadsheet and **CSV export**.
- **Backups:** the data lives only in the Chrome profile (`storage.local` or IndexedDB) and is lost on reinstall, so export is a must; remind about a backup monthly. Until export exists, the spreadsheet stays the main record.
- **Later:** check whether the journal can sync with CMC portfolio transactions.
- **Later:** show separately how much profit came from staking and how much from price growth (needs the journal).

### 7. Manual rates for places without an API

For wallets and services whose rates can't be fetched (Walt / Telegram Wallet, a NIBI staking service) — a settings field: portfolio → coin → rate (and term). The extension shows it in the Earn column next to the exchanges and counts "now" income from it. These rates don't change daily, so updating them by hand now and then is easy. Low priority for now: only a coin or two sit in such places.

**Walt (ex. Wallet in Telegram), checked 2026-11-13:** not possible automatically. No public rates (walt.io, help.walt.io — examples only); the mini app API (`walletbot.me/earn/public-api/v1/campaigns/`) returns 401 without Telegram auth; "Dollars" go through Ethena (~5.25%), but Walt pays its own rate with a markup and bonuses, so it can't be derived from public data.

### 8. Other

- **Bot commands:** `/rates btc` in Telegram returns the current rates (works while Chrome is running).
- **Exchange "trust":** the user sets a weight per exchange, and sorting accounts for risk.
- **New exchanges:** Gate, KuCoin, Bitget — first check for public endpoints.
- **Rate history:** rates are checked every few hours anyway, so they could be stored and drawn as a small chart next to the exchange.
- **"Better rate than yours" alerts:** a separate alert when a coin sits at a noticeably worse rate than the best one (the weekly summary covers this for now).

## Tech debt

- Automatic release notes from commits (`releaseNotes` in `.release-it.json`).
