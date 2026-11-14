# CMC Helper — roadmap

_Updated: 2026-11-14. Status: **v1.0.0 released**; branch `release_1.1.0` adds BingX, promo alerts, the weekly summary and the rates cache._

## 1. Portfolios bound to exchanges ✅ (branch `release_1.0.0`)

Done: in the Earn column, a ring around the exchange where the coin sits, "no earn" for wallets and exchanges without a product; in the settings each portfolio is bound to an exchange or "Wallet / other" (guessed from the name by default, so any names work); Telegram alerts get lines like "💼 Bybit: 0.10% → +$X/yr". A separate alert type "there's a better rate than yours" wasn't added, to avoid spam — can be added.

_Original plan:_

CMC portfolios are often named after exchanges and wallets. A coin in the `Binance` portfolio means it sits on Binance.

**Name matching** (case-insensitive, `WhiteBit` = WhiteBIT):

| Portfolio | Type |
|---|---|
| Binance, Bybit, OKX, MEXC, WhiteBit | exchange with known rates |
| BingX | exchange without rates: show "rate unknown" and the alternatives |
| Keplr, Phantom, Ready Wallet, etc. | wallet: show how much could be earned |
| small "lottery" positions | ignore |
| stablecoin savings | not an investment: ignore (unchecked in the banner) |

**What it gives:**
- the table marks the exchange where the coin sits now and shows what you miss: "Bybit 0.10% → WhiteBIT 10.39%, +$X/yr";
- personal Telegram alerts: "your POL is at 2% on Binance, OKX pays 17.75%" instead of a generic "new best rate".

**Data source — found** (while building the banner, item 9):
- `POST api.coinmarketcap.com/asset/v3/portfolio/dashboard/query-summary` with body `{}` returns all coins in one request, and each coin's `subItems` list the portfolios it's in (`portfolioName`, `portfolioSourceId`, `value`, `balance`).
- Requests go from the content script with the user's session: `credentials: 'include'` + the `x-csrf-token` header from the cookie of the same name. The wrapper is `entrypoints/content/cmcApi.ts` (retries on `40110`).
- Development uses a **real CMC account**: change nothing in it without consent, never print amounts (see `CLAUDE.md`).

**Open question:** whether to alert about coins in wallets.

## 2. Yearly income estimate ✅ (branch `release_1.0.0`)

Done: a line "≈ X/yr → Y/yr" under the rates (in coins since 1.1.0). "Now" = the best realistic rate on the exchange where the coin sits, 0% in wallets; "best" = the best realistic rate anywhere. Realistic = flexible, or fixed for longer than 14 days. Idea for later: a portfolio-wide total in the banner.

_Original plan:_

Coin amount × rate = expected income. For example, 600% for 2 days on MEXC on a small amount may earn pennies. A portfolio total under the table. Uses the same data as item 1.

## 3. Native staking rates for wallets

The rate depends on the network, not the wallet: the wallet just delegates to a validator. The unbonding period becomes `days`, i.e. a pill like `21d`.

- **Group 1 — Cosmos (Keplr), one module:** TIA, SEI, DYDX, SAGA, NIBI, FET.
- **Group 2 — separate modules:** STRK (Ready), SUI, APT, ALEO (Leo Wallet).
- **Liquid staking via DefiLlama** (`yields.llama.fi/pools`, public, no key). Already checked:
  - **SOL:** Sanctum Infinity 5.53%, Jupiter 5.03%, Jito 4.96%, BlazeStake 4.69%, Marinade 4.67%;
  - **STRK:** Endur 6.13%.

  Needs a token mapping, e.g. JitoSOL → SOL.
- **Group 3 — later:** MINA, ROSE, ONE, CFX, ASTR, SUPRA, POL.
- **Not possible:** Telegram Wallet Earn — most likely an internal API behind auth.

### Source research (2026-11-13)

Every source was checked with plain `curl`, no keys, no auth. All rates below are network rates before the validator fee (usually 5–20%), so show them as "≈X%".

| Coin | Source | Now | Unbonding | Effort |
|---|---|---|---|---|
| TIA | `chains.cosmos.directory/celestia` → `.chain.params.calculated_apr` (fraction) | ≈5.2% | 14d | easy |
| FET | `chains.cosmos.directory/fetchhub` → `calculated_apr` (not `estimated_apr`) | ≈7.1% | 21d | easy |
| SAGA | `chains.cosmos.directory/saga` → `calculated_apr` | ≈55% (real: only ~5% of supply is staked) | 21d | easy, but show with a note |
| STRK | Endur: `app.endur.fi/api/stats` → `.apy` (6.13% after Endur's 15% fee); native ≈ `.apy / 0.85` or via RPC `api.zan.top/public/starknet-mainnet` | native ≈7.2%, xSTRK ≈6.1% | 7d | easy (via Endur) |
| APT | `api.mainnet.aptoslabs.com/v1/accounts/0x1/resource/0x1::staking_config::StakingRewardsConfig` → `rewards_rate.value / 2^64 × 4380` | ≈2.6% (≈2.3% after fee) | up to 14d | easy; Aptos rate-limits anonymous requests per IP |
| SEI | `rest.cosmos.directory/sei`: `total_mint_amount` from `seichain/mint/v1beta1/minter` ÷ `bonded_tokens` from `cosmos/staking/v1beta1/pool` | ≈4.0% | 21d | medium, not verified against real rewards |
| NIBI | `rest.cosmos.directory/nibiru`: `epoch_mint_provision × 360 × 0.28125 × 0.98 ÷ bonded` | ≈18% | 21d | medium, not verified |
| SUI | GraphQL `graphql.mainnet.sui.io`: previous epoch rewards × 365 ÷ `total_stake` | ≈1.3% | ~1d | medium |
| ALEO | `api.explorer.provable.com/v1/mainnet`: block rewards ÷ total stake from `/committee/latest` | ≈7–10% (depends on block fees) | ~17 min | hard; native delegation from 10,000 ALEO |
| DYDX | no ready source; rewards are paid in USDC from trading fees | ≈2% in USDC, a noisy figure | 21d | ❌ don't show |

**Notes:**
- `chains.cosmos.directory/` returns all Cosmos chains in one request (~2 MB). It's a free community service by ECO Stake, no guarantees. `calculated_apr` is null for SEI, DYDX and NIBI.
- **SEI** has no inflation: it mints a fixed amount per year, so the standard formula doesn't apply.
- **NIBI:** stakers get only 28.125% of inflation, so "inflation ÷ staked" overstates the rate about threefold.
- **STRK:** the 0.75 factor in the native formula (25% of rewards go to BTC stakers) was assumed, not read from the chain, but the result matches Endur exactly. Simpler to take Endur `.apy / 0.85`.
- **SUI:** the rate slowly declines as the staking subsidy shrinks. The old JSON-RPC is off; only GraphQL is left.
- **APT:** use `StakingRewardsConfig`, not the deprecated `StakingConfig.rewards_rate`. The rate is already at its floor.
- **DefiLlama** (liquid staking with TVL > $5M): for these coins only Endur (xSTRK, 6.13%). SUI has lending only, not staking; APT — Amnis 2.36% with TVL $2.4M; TIA — nothing.

**Order:**
1. One "Cosmos" module: TIA, FET, SAGA via `calculated_apr` in one request.
2. STRK via Endur, APT via `StakingRewardsConfig`.
3. Modules with their own formulas: SEI, NIBI, SUI.
4. ALEO if needed.

Don't show DYDX.

## 4. Fixed-term expiry reminders

The user enters, e.g., "BTC — WhiteBIT 30d, opened 12.11". A day before the term ends, Telegram gets "your plan ends tomorrow, here are the best rates now". The start date will most likely have to be entered manually.

## 5. Rate history and promo detection

Rates are checked every few hours anyway, so they can be stored and drawn as a small chart next to the exchange. A sudden jump (like MEXC 600%) could be marked "likely a promo". (1.1.0 already treats fixed terms up to 14 days as promos.)

## 6. Alerts for "lottery" coins

A portfolio of small "lottery" positions held until altseason. No point analysing them daily, but two things matter:

- **Delisting.** A Telegram alert when an exchange announces a delisting of a portfolio coin: "⚠️ Bybit delists XYZ on 25.11 — you hold XYZ in the Bybit portfolio". The goal is to sell or withdraw while it's still possible.
  - Sources: Bybit and OKX probably have public announcement APIs with a delisting category; Binance publishes them via an internal website endpoint. **Check live before building.**
  - Coins already delisted: check whether they can still be withdrawn to a wallet.
- **Sharp rise.** An alert when a lottery coin pumps, e.g. +100% in a day or ×5 from the entry price, so you don't miss the moment and take some profit by a rule decided in advance (e.g. take out what you put in).

Both use the portfolio binding from item 1.

## 7. Ratio trading signals

An alternative to staking whose goal is more coins, not more dollars. The idea: watch the price ratio of two coins. When the coin you hold gets temporarily expensive relative to the other, swap part of it; when the ratio returns to its usual level, swap back.

**Format:** scheduled alerts only, all swaps are manual. No auto-trading and no exchange API keys in the browser. Alerts in plain words, no indicators, e.g.:

> 🔄 OP / ARB. Over the last 3 months 1 OP usually cost ≈X ARB, now it's Y — it's this expensive only on 5% of days. Over 2 years this strategy gave +20% more OP (10 swaps).

### Backtest (2026-11-13, Binance daily prices since ~02.2024, 0.2% fee per swap)

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
- Pairs are set in the settings. The coin you hold comes from the portfolio (item 1).
- Next to each direction — backtest stats on Binance history. For directions with a historical loss, don't alert or warn explicitly.
- Prices — Binance daily candles `/api/v3/klines`; checked once a day.

## 8. Swap journal

Swaps are usually tracked in a spreadsheet. A journal in the extension would replace it and hold the state for the signals in item 7: to say "swap back", the extension must know whether the previous signal was acted on and what state the pair is in (50/50 or 25/75).

- **One-click entry** from an alert or the settings page; fields prefilled with current prices, the user corrects amounts to what was actually filled.
- **Result of each round** (A → B → A): "+6.2% TIA vs doing nothing", plus a total per pair.
- **CSV import** from an existing spreadsheet and **CSV export**.
- **Backups:** the data lives only in the Chrome profile (`storage.local` or IndexedDB) and is lost on reinstall, so export is a must; remind about a backup monthly. Until export exists, the spreadsheet stays the main record.
- **Later:** check whether the journal can sync with CMC portfolio transactions.

## 9. Total invested and profit/loss ✅ (branch `release_1.0.0`)

Done: a banner at the very top of the portfolio page (Overview and each portfolio) — **Invested / Value / Profit-Loss** across all portfolios.
- Data — CMC's own statistics (`portfolio/queryStatistics` per portfolio, summed).
- **Invested = Value − P/L** (net invested): CMC's "Cost Basis" is the sum of all buys and counts money moved through swaps twice; it's in the tooltip.
- Portfolios that aren't investments are unchecked on the settings page.
- When CMC hides balances, the amounts are hidden too and only the percentage stays.

Idea for later: show separately how much profit came from staking and how much from price growth (needs the journal, item 8).

## 10. Other

- **Bot commands:** `/rates btc` in Telegram returns the current rates (works while Chrome is running).
- **Exchange "trust":** the user sets a weight per exchange, and sorting accounts for risk.
- **New exchanges:** Gate, KuCoin, Bitget — first check for public endpoints.

## 11. Manual rates for places without an API

For wallets and services whose rates can't be fetched (Walt / Telegram Wallet, a NIBI staking service) — a settings field: portfolio → coin → rate (and term). The extension shows it in the Earn column next to the exchanges and counts "now" income from it. These rates don't change daily, so updating them by hand now and then is easy. Low priority for now: only a coin or two sit in such places.

**Walt (ex. Wallet in Telegram), checked 2026-11-13:** not possible automatically. No public rates (walt.io, help.walt.io — examples only); the mini app API (`walletbot.me/earn/public-api/v1/campaigns/`) returns 401 without Telegram auth; "Dollars" go through Ethena (~5.25%), but Walt pays its own rate with a markup and bonuses, so it can't be derived from public data.

**Ready wallet — ✅ done** (STRK 6.50% from the wallet's own API).

**BingX — ✅ done in 1.1.0** (rates read from its Earn page, see the README).

## 12. Syncing coin amounts with exchanges via an API key (next big feature after 1.1.0)

A read-only exchange key in the settings, bound to a portfolio. The worker signs requests (HMAC via WebCrypto) and reads balances: spot + Earn/staking + funding. The content script never sees the keys.

- On CMC next to a coin whose amount on the exchange ≠ the amount in the portfolio: "on the exchange +N / −N" and a **Sync** button that adds a transaction for the difference (like Set amount). Only with confirmation: the "no unapproved transactions" rule.
- **The difference: a buy or a reward?** The exchange only knows the amount. Ideas:
  - choose when syncing: Buy at the current price / 🎁 Free;
  - a hint from the source: growth of an Earn position without deposits = reward; a matching buy or deposit in the exchange's history = buy (the price can be taken from the trade);
  - a decrease: a sale or a withdrawal (a transfer to another portfolio, not a sale).
- Check per exchange whether the API returns Earn positions fully (least certain: MEXC, WhiteBIT; BingX Wealth returns only a USDT total).
- Keys stay local, like the bot token; read-only only. Test with a real read-only key, starting with Binance.

## Tech debt

- ~~Rates cache, so opening the portfolio doesn't fire ~90 requests (mostly WhiteBIT fixed plans).~~ ✅ 1.1.0: the worker caches rates.
- release-it didn't attach the zip to the v0.0.4 release — find out from the next release's output.
- Automatic release notes from commits (`releaseNotes` in `.release-it.json`).
- ~~Filter MEXC's short promos (1–2 days) out of alerts.~~ ✅ 1.1.0: terms up to 14 days are promos with their own "🎁" alerts.
