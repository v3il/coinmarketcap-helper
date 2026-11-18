# Average price calculator — design

_2026-11-18. Small change._

## Intent

Before buying more of a coin that is in drawdown, see what the buy would do: type how many dollars you'd add and
instantly see the new average entry price and the new drawdown, in %. Information only — it helps decide whether and
how much to average down.

## Goals / non-goals

- **Goal:** a quick "what if I buy for $X" preview per coin, per portfolio, on the CMC portfolio pages.
- **Non-goal:** recording the buy. The calculator never adds a transaction (that's what Set amount is for).
- **Anti-goal:** breaking or cluttering Set amount, or anything that silently writes to the account.

## Approaches

1. **A separate calculator button next to Set amount's "+"** with its own small popup. — **Picked.** Simple,
   read-only by construction, Set amount stays as it is.
2. A "$" mode inside Set amount that previews and can then record the buy. — Not needed: the owner wants
   information only, and it would make Set amount's popup more complex.
3. An item in CMC's own "…" row menu. — Rejected: CMC renders that menu on demand, the injected item would break
   on any CMC markup change.

## Design

- **Where:** a small 🧮 button next to the "+" in every row where Set amount appears (Holdings on a single-portfolio
  table, Balance on the overview). Same placement rules, same portfolio identification.
- **Popup:** same look and behaviour as Set amount's editor (absolutely positioned, Esc / ✕ / click outside closes,
  clicks don't reach CMC's row handlers). On the overview, when the coin sits in several portfolios, a portfolio
  picker like Set amount's.
- **Input:** "Buy for $" — a positive number (decimals allowed).
- **Output, live under the input:**
  - average price: now → after;
  - drawdown (or profit) %: now → after.
- **Data (already loaded, nothing new from CMC):**
  - position cost per portfolio: `loadPositionCosts()` (value − CMC's P/L);
  - coin amount per portfolio and current price: the `PortfolioSnapshot`.
- **Formulas** (pure functions in `lib/`, unit-tested):
  - average = cost / coins;
  - new average = (cost + usd) / (coins + usd / price);
  - drawdown = price / average − 1 (negative = drawdown, positive = profit).
- **Meaning of "average":** it follows CMC's P/L, so 🎁 Free coins (bought at $0) lower it, and realized profit from
  past sales lowers it too — it's effectively the break-even price and may differ from CMC's "Avg Buy Price" column.
- **Edge cases:** no cost data for the portfolio (e.g. not a manual portfolio) or zero coins → no button. Cost ≤ 0
  (position fully paid back) → show "already paid back" instead of an average. Position in profit → buying raises the
  average; the numbers simply show it.
- **Hidden balances** (CMC's hide mode): percentages are still shown; the average price is a price, not an amount, so
  it's shown as well.

## Left to the builder

- The button's exact icon/position next to "+", and the popup's styling details (reuse Set amount's CSS classes where
  it fits).
- Where the calculator code lives (`entrypoints/content/averageCalculator.ts` suggested) and how it gets the position
  costs (passed through the render context from `main.ts`).
