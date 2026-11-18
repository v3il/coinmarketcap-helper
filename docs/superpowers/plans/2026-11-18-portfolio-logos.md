# Portfolio Logos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CMC's portfolio avatars with exchange / wallet logos in the sidebar and the overview table, behind a settings checkbox.

**Architecture:** A pure `lib/portfolioIcons.ts` picks the icon for a portfolio name (tested). A content module `entrypoints/content/portfolioIcons.ts` swaps the `img` srcs, idempotently, from `main.ts`'s update loop. The setting travels like the other page settings (storage → worker → `PageSettings`).

**Tech Stack:** TypeScript, WXT (MV3), Preact options page, vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-portfolio-logos-design.md`

## Global Constraints

- Never changes anything in the CMC account; only `img.src` on the page.
- When unsure (counts differ, unknown name in the table), leave CMC's avatar.
- Setting `portfolioLogos`, default `true`.
- Public repo: no amounts in code, tests, commits.
- Work on `release_1.2.0`.

## Review Focus

- **Setting turned off while the page is open** → every replaced img gets its original src back. Manual check, Task 2.
- **CMC re-renders an img with a new src (e.g. after editing a portfolio)** → the new src is taken as the original, not overwritten by a stale one. Task 2 code: compare the current src with our last set src.
- **Portfolio renamed in CMC, so the settings binding is stale** → falls back to the name guess / generic icon, no crash. Covered by Task 1 tests (unknown name → generic).
- **A table row whose avatar count differs from the data** → row untouched. Manual check, Task 2.
- **Single-portfolio page (no stack)** → sidebar still replaced, no errors. Manual check, Task 2.

---

### Task 1: Icon choice

**Files:**
- Create: `lib/portfolioIcons.ts`, `lib/portfolioIcons.test.ts`

**Interfaces:**
- Produces:
  - `GENERIC_WALLET_ICON: string` — an inline SVG data URL (a simple wallet outline on a neutral rounded square).
  - `portfolioIcon(name: string, exchange: Exchange | null, asset: (path: string) => string): string`:
    1. `exchange && exchange.id !== 'wallet'` → `exchange.logoUrl`;
    2. normalized name (lower case, letters/digits only) contains `phantom` / `keplr` / `leo` / `telegram` → `asset('wallets/phantom.svg' | 'wallets/keplr.png' | 'wallets/leo.png' | 'wallets/telegram.png')`; contains `ready` → the Ready exchange's `logoUrl` (from `EXCHANGES`);
    3. else `GENERIC_WALLET_ICON`.

- [ ] **Step 1: Failing tests** (`asset = (path) => `ext://${path}``; exchanges from `EXCHANGES` by id):
  - `portfolioIcon('Binance', binance, asset)` → `binance.logoUrl`
  - `portfolioIcon('Phantom', nativeStaking, asset)` → `'ext://wallets/phantom.svg'`
  - `portfolioIcon('Keplr', null, asset)` → `'ext://wallets/keplr.png'`
  - `portfolioIcon('Leo Wallet', nativeStaking, asset)` → `'ext://wallets/leo.png'`
  - `portfolioIcon('Telegram', null, asset)` → `'ext://wallets/telegram.png'`
  - `portfolioIcon('Ready Wallet', null, asset)` → ready's `logoUrl`
  - `portfolioIcon('Trash', null, asset)` and `portfolioIcon('Earn', nativeStaking, asset)` → `GENERIC_WALLET_ICON`
- [ ] **Step 2: Run** `npx vitest run lib/portfolioIcons.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `lib/portfolioIcons.ts`.
- [ ] **Step 4: Run** `npm test && npm run compile && npm run lint` — Expected: pass.
- [ ] **Step 5: Commit** `Portfolio icon choice: exchange, wallet or generic`.

### Task 2: Swap the avatars, setting, assets

**Files:**
- Create: `entrypoints/content/portfolioIcons.ts`; `public/wallets/{phantom.svg,keplr.png,leo.png,telegram.png}` (from the scratchpad downloads)
- Modify: `entrypoints/content/cmcApi.ts` (snapshot order), `entrypoints/content/main.ts`, `entrypoints/content/pageSettings.ts`, `entrypoints/content/styles.css`, `lib/messages.ts`, `lib/storage.ts`, `entrypoints/background.ts`, `entrypoints/options/App.tsx`, `wxt.config.ts`, `README.md`, `ROADMAP.md`

**Interfaces:**
- Consumes: `portfolioIcon`, `GENERIC_WALLET_ICON` (Task 1); `exchangeResolver` (lib/holdings).
- Produces:
  - `PortfolioSnapshot.portfolioOrder: Map<string, string[]>` — lower-case symbol → portfolio names from all `subItems`, in CMC's order.
  - `Settings.portfolioLogos: boolean` (default `true`), `PageSettings.portfolioLogos: boolean`.
  - `renderPortfolioIcons(options: { enabled: boolean; iconOf: (portfolio: string) => string; order: Map<string, string[]> | null }): void`.

- [ ] **Step 1: Assets + manifest** — copy the four logos to `public/wallets/`; `wxt.config.ts` manifest gets `web_accessible_resources: [{ resources: ['wallets/*'], matches: ['https://coinmarketcap.com/*'] }]`.
- [ ] **Step 2: Setting plumbing** — `Settings.portfolioLogos` + default `true`; `PageSettings.portfolioLogos`; worker's `getPageSettings` returns it; `pageSettings.ts` `EMPTY.portfolioLogos = true`; options page: a checkbox "Exchange and wallet logos instead of CMC avatars" in the Portfolios section, saved right away (same pattern as `onToggleBingx`).
- [ ] **Step 3: Snapshot order** — `fetchPortfolioSnapshot` fills `portfolioOrder` from every `subItems` entry's `portfolioName` (before the zero-balance filter).
- [ ] **Step 4: `renderPortfolioIcons`** —
  - sidebar: every `[data-rbd-draggable-id]` → `.name` text → its `img[alt="portfolio-avator"]`;
  - overview table: every `table tbody tr` with `.symbol-name` → its `img[alt="portfolio-avator"]` list; names = `order.get(symbol)`; only when `names.length === imgs.length`;
  - swapping one img: if `img.src !== img.dataset.cmcHelperIcon` (CMC set a new src, or never touched) store `img.src` in `dataset.cmcHelperAvatar`; set `src` and `dataset.cmcHelperIcon` to the icon; add class `cmc-helper-logo`. When `!enabled`: imgs with `dataset.cmcHelperAvatar` get it back, data and class removed.
  - Idempotent: nothing is written when the src is already the wanted one (the MutationObserver re-runs it).
- [ ] **Step 5: `main.ts`** — in `update()`, after settings/snapshot are known: `renderPortfolioIcons({ enabled: settings?.portfolioLogos ?? true, iconOf: (name) => portfolioIcon(name, resolveExchange(name), (path) => browser.runtime.getURL(path)), order: snapshot?.portfolioOrder ?? null })`. Runs before the `await rates` so icons don't wait for rates.
- [ ] **Step 6: CSS** — `img.cmc-helper-logo { object-fit: contain; background: #fff; }` (logos with transparency stay visible on CMC's dark frame; check how it looks, drop the background if it's worse).
- [ ] **Step 7: Docs** — README feature line; ROADMAP 1.2.0 line "**Portfolio logos:** exchange / wallet logos instead of CMC's avatars in the sidebar and the overview table; a setting to turn off."
- [ ] **Step 8: Verify** `npm test && npm run compile && npm run lint && npm run build` — pass. Manual check is the owner's (the DevTools browser has no extension): sidebar, overview table, a single portfolio, the checkbox off/on, changing a portfolio's exchange.
- [ ] **Step 9: Commit** `Portfolio logos instead of CMC avatars`.
