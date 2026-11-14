# CoinMarketCap Helper — working rules

The extension is developed and tested on a real CoinMarketCap account. The rules below are for the AI assistant (Claude Code) working on this repository.

## Working with the real CoinMarketCap account

1. **Never state amounts.** Neither in dollars nor as coin counts in the portfolio. Where possible, use percentages: share, change, profit/loss in %. This applies to chat, commits, PRs, files in the repository and test data.
2. **No transactions without approval.** Any new transaction in a portfolio (buy, sell, transfer, etc.) only after the account owner explicitly allows it. Ask first what exactly to add.
   - **Exception for tests:** in the portfolio set aside for tests (`Trash`), test transactions on one of its coins may be added and removed — minimal amounts, and everything created is deleted after the test. Other portfolios — only with permission.
3. **Portfolios may be renamed only if the name keeps its meaning.** E.g. `WhiteBit` → `WhiteBIT` is fine. Changing which exchange or wallet a portfolio stands for is not: `MEXC` can't become `BingX`.
4. **Never ask for the CMC password.** The owner logs in themselves; the assistant only reads the page and its requests.

## The repository is public

- Commit nothing personal: amounts, balances, portfolio composition, tokens and keys (Telegram bot, GitHub, exchanges).
- `.env` (the release token) is never committed or printed.

## Other

- Feature plan: `ROADMAP.md`.
- Push with `git push origin`; open PRs with `gh pr create --repo v3il/coinmarketcap-helper`, PR title = branch name.
- Release: release-it with the token from `.env`; the zip is attached to the GitHub release.
- Code, comments, commits, PRs and docs are in English.
