import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
    zip: {
        artifactTemplate: 'coinmarketcap-helper@v{{version}}.zip'
    },

    manifest: {
        description: 'coinmarketcap-helper',
        name: 'coinmarketcap-helper',
        host_permissions: [
            'https://coinmarketcap.com/*',
            'https://www.binance.com/*',
            'https://api.bybit.com/*',
            'https://www.okx.com/*',
            'https://www.mexc.com/*',
            'https://internal.whitebit.com/*'
        ]
    }
});
