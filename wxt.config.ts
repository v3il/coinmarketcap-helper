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
            default_title: 'CMC Helper settings'
        },
        permissions: ['storage', 'alarms'],
        // Wallet logos shown on the CMC page instead of its portfolio avatars.
        web_accessible_resources: [{ resources: ['wallets/*'], matches: ['https://coinmarketcap.com/*'] }],
        host_permissions: [
            'https://coinmarketcap.com/*',
            'https://www.binance.com/*',
            'https://api.bybit.com/*',
            'https://www.okx.com/*',
            'https://www.mexc.com/*',
            'https://internal.whitebit.com/*',
            'https://cloud.argent-api.com/*',
            'https://chains.cosmos.directory/*',
            'https://api.mainnet-beta.solana.com/*',
            'https://api.mainnet.aptoslabs.com/*',
            'https://rest.cosmos.directory/*',
            'https://graphql.mainnet.sui.io/*',
            'https://api.coinmarketcap.com/*',
            'https://api.telegram.org/*'
        ]
    }
});
