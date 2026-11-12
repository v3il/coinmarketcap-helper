import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
    zip: {
        artifactTemplate: 'coinmarketcap-helper@v{{version}}.zip'
    },

    vite: () => ({
        plugins: [preact()]
    }),

    manifest: {
        description: 'coinmarketcap-helper',
        name: 'coinmarketcap-helper',
        // Clicking the toolbar icon opens the settings page (see background.ts).
        action: {
            default_title: 'CMC Helper — налаштування'
        },
        permissions: ['storage', 'alarms'],
        host_permissions: [
            'https://coinmarketcap.com/*',
            'https://www.binance.com/*',
            'https://api.bybit.com/*',
            'https://www.okx.com/*',
            'https://www.mexc.com/*',
            'https://internal.whitebit.com/*',
            'https://api.telegram.org/*'
        ]
    }
});
