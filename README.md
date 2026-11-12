# 📘 CoinMarketCap Helper

---

## 🌟 Overview

This extension enhances the CoinMarketCap **Portfolio** page by automatically fetching real-time **staking APR / APY** rates for every coin listed in your portfolio.

Once active, it displays these yields directly in the portfolio table.

> ⚠️ **Note:** This is an **early version**. The extension is still evolving and will be expanded with new features, improvements, and additional data sources over time.

---

## ✨ Key Features
- 💰 **Multi-exchange support** — pulls APY rates from **Binance**, **Bybit**, and **OKX**.
- 📈 **Inline display** — shows staking yields right next to each coin on the page.
- ⚡ **Fast & lightweight** — no login, no API keys.
- 🔒 **Private** — all data is fetched locally; nothing is sent anywhere else.

---

## 💡 Example
![README-1.png](README-1.png)

---

## 🧩 Installation

1. Download the latest release (`coinmarketcap-helper@vX.Y.Z.zip`) from the [releases page](https://github.com/v3il/coinmarketcap-helper/releases).
2. Unzip the archive to any directory.
3. Open the Chrome extensions page: [chrome://extensions/](chrome://extensions/).
4. Enable **Developer mode** (toggle in the top right corner).
5. Click **"Load unpacked"**, then select the directory where you extracted the extension.

---

## 🛠️ Credits

Built with ❤️ for personal portfolio tracking convenience.  
Supports **Binance**, **Bybit**, and **OKX** staking endpoints.

---

## 🛠️ Development

```bash
npm install
npm run dev      # Chrome with the extension loaded and hot reload
npm run build    # production build into .output/chrome-mv3
npm run lint && npm run compile
```

Each exchange is a small module in `lib/exchanges/` that exports an `Exchange`
(`id`, `name`, `logoUrl`, `loadRates()` → `Map<symbol, APR %>`). To add one, create a module and list it in
`lib/exchanges/index.ts`, and add the API host to `host_permissions` in `wxt.config.ts`.

---

## 🔔 Telegram alerts

The extension can check rates in the background (while Chrome is running) and message you in Telegram
when the best rate for a coin in your portfolio grows.

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy its token.
2. Click the extension icon → paste the token, send `/start` to your bot, then press **Знайти** to fill in the chat id.
3. Press **Тестове повідомлення** to check, then **Зберегти**.
4. Open your portfolio on CoinMarketCap once, so the extension learns which coins to watch.

The token is stored only in this browser's local extension storage.
