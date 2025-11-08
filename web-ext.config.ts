import { defineWebExtConfig } from 'wxt';
import { resolve } from 'node:path';

export default defineWebExtConfig({
    chromiumProfile: resolve('.wxt/chrome-data'),
    keepProfileChanges: true
});
