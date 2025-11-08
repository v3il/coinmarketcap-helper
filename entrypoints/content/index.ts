import { main } from './main';

export default defineContentScript({
    matches: ['https://coinmarketcap.com/*'],
    runAt: 'document_start',
    main
});
