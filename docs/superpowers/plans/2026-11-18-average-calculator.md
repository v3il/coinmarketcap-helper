# Average Price Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only 🧮 popup next to Set amount's "+" that shows how buying a coin for $X changes its average price and drawdown.

**Architecture:** Pure math and input parsing in `lib/averaging.ts` (unit-tested). A new content module `entrypoints/content/averageCalculator.ts` builds the popup; `amountEditor.ts` adds the second button in the same cells and passes each place's cost. `main.ts` loads position costs (already cached in `holdings.ts`) and passes them through the editor context.

**Tech Stack:** TypeScript, WXT content script, vitest, plain DOM via the `h()` helper.

**Spec:** `docs/superpowers/specs/2026-11-18-average-calculator-design.md`

## Global Constraints

- Never adds a transaction and makes no new CMC requests: only `loadPositionCosts()` and the existing snapshot.
- Average = cost / coins, where cost = value − CMC's P/L (`PositionCosts`), so it's the break-even price.
- New average = (cost + usd) / (coins + usd / price); change = price / average − 1.
- The public repo: tests, commits and docs use made-up numbers only, never real positions.
- Code, comments, UI copy, commits in English.
- Work on branch `release_1.2.0`; ships in 1.2.0.

## Review Focus

- **"1,000" typed as a dollar amount** → read as 1000 (USD style: comma = thousands, dot = decimal). Test in Task 1.
- **Position fully paid back (cost ≤ 0)** → no average and no change % (shown as "paid back"), no NaN/Infinity. Test in Task 1.
- **Position in profit** → the change is positive, shown with "+", and buying raises the average. Test in Task 1.
- **Overview, coin in several portfolios, only some with a known cost** → the picker lists only those with a cost; no button when none. Manual check in Task 2.
- **After Set amount adds a transaction** → the calculator uses fresh costs (costs cache is dropped by `invalidateHoldings()`; the button key includes the cost so it re-renders). Manual check in Task 2.

---

### Task 1: Averaging math and dollar-amount parsing

**Files:**
- Create: `lib/averaging.ts`
- Test: `lib/averaging.test.ts`

**Interfaces:**
- Produces:
  - `interface Position { coins: number; cost: number }` — cost in USD.
  - `interface PositionStats { average: number | null; change: number | null }` — `change` is a fraction (−0.42 = −42%); both `null` when `coins <= 0` or `cost <= 0`.
  - `positionStats(position: Position, price: number): PositionStats`
  - `afterBuy(position: Position, price: number, usd: number): Position` — `{ coins: coins + usd / price, cost: cost + usd }`.
  - `parseUsd(text: string): number | null` — strips spaces, `_`, `$` and `,`; must then match `^\d+(\.\d+)?$` and be > 0, else `null`.
  - `formatPrice(value: number): string` — moved here from `amountEditor.ts` unchanged (`value >= 1 ? toFixed(2) : toPrecision(4)`).
  - `formatChange(change: number): string` — one decimal, sign always shown, minus as "−": `-0.42 → "−42.0%"`, `0.1 → "+10.0%"`, `0 → "0.0%"`.

- [ ] **Step 1: Write the failing tests** in `lib/averaging.test.ts`:
  - `positionStats({ coins: 10, cost: 20 }, 1)` → `{ average: 2, change: -0.5 }`
  - in profit: `positionStats({ coins: 10, cost: 5 }, 1)` → `{ average: 0.5, change: 1 }`
  - paid back: `positionStats({ coins: 10, cost: 0 }, 1)` and `cost: -3` → `{ average: null, change: null }`; `coins: 0` → same.
  - `afterBuy({ coins: 10, cost: 20 }, 1, 10)` → `{ coins: 20, cost: 30 }`, and its stats → `average: 1.5`, `change` ≈ `-1/3` (`toBeCloseTo`).
  - `parseUsd`: `"100" → 100`, `"12.5" → 12.5`, `"1,000" → 1000`, `" $250 " → 250`, `"" → null`, `"0" → null`, `"-5" → null`, `"abc" → null`, `"1.2.3" → null`.
  - `formatChange`: `-0.42 → "−42.0%"`, `0.1 → "+10.0%"`, `0 → "0.0%"`.
  - `formatPrice`: `1234.5 → "1234.50"`, `0.012345 → "0.01235"`.

- [ ] **Step 2: Run** `npx vitest run lib/averaging.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `lib/averaging.ts` with the signatures above; in `entrypoints/content/amountEditor.ts` delete the local `formatPrice` and import it from `@/lib/averaging`.

- [ ] **Step 4: Run** `npm test && npm run compile && npm run lint` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/averaging.ts lib/averaging.test.ts entrypoints/content/amountEditor.ts
git commit -m "Averaging math for the average price calculator"
```

### Task 2: Calculator popup, button and wiring

**Files:**
- Create: `entrypoints/content/averageCalculator.ts`
- Modify: `entrypoints/content/amountEditor.ts` (context, places, button rendering, outside-click handler)
- Modify: `entrypoints/content/main.ts` (load costs, pass them in)
- Modify: `entrypoints/content/styles.css` (second button, wider cell padding, result lines)
- Modify: `README.md`, `ROADMAP.md` (1.2.0 line)

**Interfaces:**
- Consumes: Task 1's `Position`, `positionStats`, `afterBuy`, `parseUsd`, `formatPrice`, `formatChange`; `PositionCosts` from `cmcApi.ts` (symbol → portfolio **name** → cost).
- Produces:
  - `interface CalcPlace { id: string; name: string; coins: number; cost: number }`
  - `openCalculator(cell: HTMLElement, ticker: string, price: number, places: CalcPlace[]): void` in `averageCalculator.ts`.
  - `AmountEditorContext` gains `costs: PositionCosts | null`.

- [ ] **Step 1: `main.ts`** — keep `costs: PositionCosts | null` and `costsPromise` next to `snapshot`, loaded in `refreshData()` the same way as the snapshot (`loadPositionCosts()` returns the same promise while cached; on a new promise store the value, `version++`, `scheduleUpdate()`). Pass `costs` to `renderAmountEditors`.

- [ ] **Step 2: `averageCalculator.ts`** — `openCalculator` builds a popup with the existing `cmc-helper-editor` classes (so the outside-click handler and styles apply), `role="dialog"`, `aria-label="Average ${ticker} price"`:
  - portfolio `<select class="cmc-helper-editor__portfolio">` when `places.length > 1`, options = names only;
  - row: input (`inputmode="decimal"`, placeholder `Buy for $`, `aria-label="Buy ${ticker} for, USD"`) and ✕ (`cmc-helper-editor__cancel`, Esc also closes);
  - result block `cmc-helper-calc__result` with two lines, updated on every input and picker change:
    - empty input: `Avg $<avg> · <change>` and a hint `Type how many dollars you'd add`;
    - valid amount: `Avg $<avg> → $<newAvg>` and `<change> → <newChange>`;
    - invalid (parseUsd → null, non-empty): error `Type a dollar amount` (status `--error` class);
    - `average === null`: `Paid back` instead of the price and the %.
  - Stop `click`/`mousedown`/`pointerdown` propagation like the editor does; focus the input on open.

- [ ] **Step 3: `amountEditor.ts`** — in `renderAmountEditors`, per row, after the "+" button:
  - `calcPlaces = places` joined with `context.costs?.get(symbol)?.get(place.name)`, kept only when the cost is a number and `place.balance > 0`, mapped to `CalcPlace` (`coins: place.balance`);
  - when `calcPlaces.length > 0` and `coin.price > 0`: append a `button.cmc-helper-calc` (🧮, `title="Average price calculator"`, `aria-label="${TICKER} average price calculator"`), with its own `dataset.key` = `ids:coins:cost` of each calc place, rebuilt only when the key changes (same idempotent pattern as the "+"); on click `closeEditors()` then `openCalculator(cell, TICKER, coin.price, calcPlaces)`;
  - the outside-click handler also ignores `.cmc-helper-calc`.
  - Note: the "+" is rebuilt independently; the 🧮 must survive the "+"'s rebuild (query each by its own class).

- [ ] **Step 4: `styles.css`** — `.cmc-helper-calc` placed left of the "+" (`right: 28px`, same size/opacity/hover as `.cmc-helper-edit`, emoji at ~11px); `.cmc-helper-editable:has(.cmc-helper-calc)` gets `padding-right: 52px !important`; `.cmc-helper-calc__result` lines like `__status` (12px), the "after" values bold.

- [ ] **Step 5: Docs** — README feature list and ROADMAP `### 1.2.0`: one line "**Average price calculator:** 🧮 next to Set amount — buy for $X → new average price and drawdown %; information only."

- [ ] **Step 6: Verify** `npm test && npm run compile && npm run lint && npm run build` — all pass.

- [ ] **Step 7: Manual check on CMC** (read-only; the owner is logged in; report only percentages, never amounts): load the built extension, then on a single portfolio and on the overview check: 🧮 appears beside "+", popup opens, typing an amount updates both lines, picker switches portfolio on the overview, Esc/✕/outside click close it, rows with no cost have no 🧮, the "+" still works and the row height doesn't change. Spot-check one coin: the "now" change % matches the P/L % CMC shows for that position.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/content docs README.md ROADMAP.md
git commit -m "Average price calculator next to Set amount"
```
