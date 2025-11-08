import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
    manifest: {
        description: 'coinmarketcap-helper',
        name: 'coinmarketcap-helper',
        host_permissions: [
            'https://coinmarketcap.com/*',
            'https://www.binance.com/*',
            'https://api.bybit.com/*',
            'https://www.okx.com/*'
        ]
    }
});
