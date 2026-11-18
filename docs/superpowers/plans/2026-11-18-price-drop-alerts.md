# Price Drop Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telegram alerts for held coins whose price fell sharply since the previous check.

**Architecture:** Pure finding/formatting in `lib/jumps.ts`, wired into `runJumpCheck` (`lib/jumpCheck.ts`), settings in `lib/storage.ts` and the options page.

**Tech Stack:** TypeScript, WXT, vitest (`fakeBrowser`).

**Spec:** `docs/superpowers/specs/2026-11-18-price-drop-alerts-design.md`

## Global Constraints

- Messages show percentages only, never amounts.
- Defaults: `dropAlerts: true`, `minDropPercent: 30`.
- Work on `release_1.2.0`.

## Review Focus

- **Jump and drop in the same check (different coins)** → two messages; a failure of one keeps only its coins' baselines. Task 2 test.
- **Drops off, jumps on** → no drop message, baselines still move. Task 2 test.
- **Exactly −30%** → alerts (threshold inclusive, like jumps). Task 1 test.
- **Old saved settings without the new keys** → defaults via `getSettings`. No code needed.

---

### Task 1: Find and format drops

**Files:** Modify `lib/jumps.ts`, `lib/jumps.test.ts`

**Interfaces — Produces:**
- `findDrops(prices: Map<string, number>, baselines: Record<string, PriceBaseline>, minPercent: number): Jump[]` — `percent` negative, kept when `percent <= -minPercent`.
- `formatDrops(drops: JumpAlert[], now: number): string` — header `<b>📉 Price drop</b>` / `drops`; per coin the same two lines as `formatJumps` (sign "−").

- [ ] **Step 1: Failing tests:** `findDrops` finds −40% at threshold 30, keeps exactly −30%, ignores −10% and rises, needs a baseline; `formatDrops` says `−35% since the last check`, adds `your position −60%`, plural header for two.
- [ ] **Step 2: Run** `npx vitest run lib/jumps.test.ts` — FAIL.
- [ ] **Step 3: Implement** (share the line formatting with `formatJumps`).
- [ ] **Step 4: Run** `npm test && npm run compile && npm run lint` — pass.
- [ ] **Step 5: Commit** `Price drops: find and format`.

### Task 2: Check, settings, options

**Files:** Modify `lib/jumpCheck.ts`, `lib/jumpCheck.test.ts`, `lib/storage.ts`, `lib/notifier.ts`, `entrypoints/options/App.tsx`, `README.md`, `ROADMAP.md`

**Interfaces:**
- Consumes: `findDrops`, `formatDrops` (Task 1).
- Produces: `Settings.dropAlerts`, `Settings.minDropPercent`; `JumpCheckResult` gains `drops: number` in both variants.

- [ ] **Step 1: Failing tests** in `lib/jumpCheck.test.ts`: a drop alerts with the coin and `−` percent; result `{ ok: true, jumps: 0, drops: 1 }`; with a jump and a drop both messages are sent; when only the drop message fails the dropped coin keeps its old baseline and the jumped one moves; `dropAlerts: false` sends nothing for drops and moves baselines. Update the existing `toEqual` results with `drops: 0`.
- [ ] **Step 2: Run** `npx vitest run lib/jumpCheck.test.ts` — FAIL.
- [ ] **Step 3: Implement** — settings keys + defaults; `runJumpCheck` sends jumps and drops as separate messages, each failure restores only its coins' baselines and reports `Failed to send price drops: …`; `notifier.ts` appends `, price drops: N`; options row under the jump row; `save()` keeps `minDropPercent` > 0 or the default.
- [ ] **Step 4: Docs** — README alerts line mentions drops; ROADMAP 1.2.0 line "**Price drop alerts:** −30% (configurable) since the previous check."
- [ ] **Step 5: Run** `npm test && npm run compile && npm run lint && npm run build` — pass.
- [ ] **Step 6: Commit** `Price drop alerts`.
