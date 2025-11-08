import { main } from './main';

export default defineContentScript({
    matches: ['https://coinmarketcap.com/portfolio-tracker/'],
    runAt: 'document_start',
    main
});
