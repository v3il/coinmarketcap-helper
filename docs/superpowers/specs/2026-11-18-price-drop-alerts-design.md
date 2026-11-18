# Price drop alerts — design

_2026-11-18. Small change. The mirror of the price jump alerts (1.2.0)._

## Intent

The jump alerts tell the owner when a held coin shoots up. They also want to know when one falls sharply, for any held
coin (no link to the "To buy" list: the owner's call).

## Design

- **When:** a held coin's price is down by at least `minDropPercent` (default 30) since the previous check, the same
  baselines as the jump alerts (they move on every check, default every 4 h). Same coin set: every held coin, however
  small; unchecked portfolios left out.
- **Message:** a separate Telegram message, like the jumps one:
  ```
  📉 Price drop
  🪙 XYZ −35% since the last check (6 h ago)
  💼 Trash · your position −60%
  ```
- **Retries:** if the message fails, those coins keep their old baselines (next check retries), like jumps.
- **Settings:** `dropAlerts: boolean` (default `true`), `minDropPercent: number` (default `30`), a row right under the
  jump alerts' row: "Price drop alerts (any coin you hold)" + "From −%, since the last check".
- The check's status line gets `, price drops: N`.

## Approaches

Only one sensible way: extend the jump check (same baselines, same prices request). A separate check would fetch the
same prices twice and keep a second set of baselines.
