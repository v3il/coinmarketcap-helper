# Portfolio logos instead of CMC avatars — design

_2026-11-18. Small change._

## Intent

CMC gives portfolios a few preset pixel avatars, so most portfolios look the same (the exchanges all share one). Show
what a portfolio actually is: the exchange's logo when the portfolio is bound to an exchange, the wallet's logo when
it's a known wallet, a generic wallet icon otherwise. In the sidebar and in the overview table.

## Goals / non-goals

- **Goal:** recognise portfolios at a glance in the sidebar and in the overview's "Portfolio Allocation" column.
- **Goal:** a settings checkbox to turn it off and get CMC's avatars back. On by default.
- **Non-goal:** changing anything in the CMC account (avatars stay as they are there).
- **Anti-goal:** a wrong logo on a portfolio. When unsure, leave CMC's avatar.

## Approaches

1. **Wallet logos bundled with the extension** (`public/wallets/`), downloaded once from the wallets' own sites. —
   **Picked.** No third-party requests at runtime, doesn't break when a site changes. New wallets are added by hand.
2. Wallet icons fetched at runtime from Google's favicon service by domain. — Rejected: Google sees the requests,
   quality varies (48–64 px).

## Design

- **Which icon** (portfolio name → URL), first match wins:
  1. bound (or guessed, as today) to an exchange other than Native staking (`wallet`) → that exchange's `logoUrl`;
  2. the name contains a known wallet: `phantom`, `keplr`, `leo`, `telegram`, `ready` → the bundled logo
     (Ready uses the existing Ready logo URL);
  3. otherwise → a generic wallet icon (inline SVG).
- **Sidebar:** each `[data-rbd-draggable-id]` item: `.name` text → replace the `img[alt="portfolio-avator"]` src.
- **Overview table:** each row's stack of `img[alt="portfolio-avator"]` is in the same order as the coin's `subItems`
  in CMC's dashboard summary (checked live: 73 of 73 rows). Replace in that order; when the counts differ, leave the
  row as it is. The order comes from all `subItems`, including zero-balance ones (CMC shows those too).
- **Restoring:** the original src is kept on the img (`data-cmc-helper-avatar`); turning the setting off restores it.
- **Setting:** `portfolioLogos: boolean`, default `true`, a checkbox in the Portfolios section of the settings page,
  saved right away like the other checkboxes; reaches the page through `PageSettings`. Changing a portfolio's
  exchange updates its icon (settings changes already re-render the page).
- **Wallet logos:** Phantom (favicon.svg from phantom.com), Keplr (symbol from keplr.app), Telegram Wallet (touch icon
  from wallet.tg), Leo Wallet (48 px favicon via Google's cache: leo.app blocks direct downloads). Declared as
  `web_accessible_resources` for coinmarketcap.com.

## Left to the builder

- The generic wallet icon's exact SVG.
- Fitting the logos into CMC's frames (40 px rounded square in the sidebar, 24 px circle in the table): `object-fit`.
