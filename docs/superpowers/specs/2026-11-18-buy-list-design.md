# "To buy" list — design

_2026-11-18. Small change._

## Intent

With some free money, the owner opens the portfolio to decide what to buy more of and gets lost among 70+ rows. Let
them mark the coins they'd like to buy more of, see those marked while scrolling, and show only those with one click.
Pairs with the 🧮 calculator: pick a marked coin, see what buying would do.

## Goals / non-goals

- **Goal:** a ☆/★ toggle per coin in the portfolio tables, a yellowish highlight on marked rows, a "★ To buy (N)"
  filter that hides the other rows.
- **Non-goal:** alerts, sorting, prices or any CMC account change. CMC's own Watchlist is not used (the owner doesn't
  use it, and "watching" ≠ "want to buy").

## Approaches

1. **Star + highlight + filter**, list in extension storage. — **Picked.**
2. Move marked rows to the top. — Rejected: CMC renders the table; reordering its rows breaks on the next re-render.
3. A separate panel listing marked coins above the table. — Rejected: duplicates the table, without 🧮 and "+".

## Design

- **Where:** the overview table and single-portfolio tables (`TABLE_SELECTOR`). The mark is per coin (lower-case
  symbol), not per portfolio.
- **Star:** a small button first in the coin's cell, before its logo (owner's call after the first try). ☆ unmarked
  (dim, always shown), ★ marked (yellow). Click toggles; it never opens CMC's coin page (stop propagation, like
  Set amount).
- **Highlight:** marked rows get a soft yellow background (`rgba(240, 185, 11, 0.14)`-ish).
- **Filter:** a small toolbar inserted right before the table wrapper with a toggle button "★ To buy (N)". On: rows
  without a mark are hidden (a class on the table + CSS), N counts the marked coins in this table. Off: everything
  back. Remembered while the tab is open (module variable). Disabled when N = 0.
- **Storage:** `favoritesItem` (`local:favorites`, `string[]` of lower-case symbols) in the worker. The page gets it as
  `PageSettings.favorites` (the content script never reads extension storage) and toggles through a new
  `FAVORITE_TOGGLE_MESSAGE { symbol }` → the worker saves and answers with the new list. The worker watches
  `favoritesItem` and notifies CMC tabs like a settings change, so other open tabs update too.
- Only tickers are stored: no amounts.

## Left to the builder

- Exact star size/position and the toolbar's styling (match the Set amount look).
