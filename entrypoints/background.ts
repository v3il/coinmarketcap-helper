import { refreshBingx, saveBingxProducts } from '@/lib/bingxRefresh';
import {
    BINGX_PRODUCTS_MESSAGE,
    BINGX_RATES_MESSAGE,
    BINGX_REFRESH_MESSAGE,
    CHECK_NOW_MESSAGE,
    HOLDINGS_MESSAGE,
    PAGE_SETTINGS_CHANGED_MESSAGE,
    PAGE_SETTINGS_MESSAGE,
    PORTFOLIO_MESSAGE,
    PORTFOLIO_NAMES_MESSAGE,
    type BingxProductsMessage,
    type HoldingsMessage,
    type PageSettings,
    type PortfolioMessage,
    type PortfolioNamesMessage
} from '@/lib/messages';
import { checkRates } from '@/lib/notifier';
import { rememberPortfolioSymbols } from '@/lib/portfolio';
import {
    bingxRatesItem, getSettings, holdingsItem, knownPortfoliosItem, settingsItem
} from '@/lib/storage';
import { FETCH_MESSAGE, fetchDirect, type FetchRequest } from '@/utils/request';

const CHECK_ALARM = 'check-rates';

async function scheduleCheck() {
    const { intervalHours } = await getSettings();
    const periodInMinutes = Math.max(1, intervalHours) * 60;
    const existing = await chrome.alarms.get(CHECK_ALARM);

    if (existing?.periodInMinutes !== periodInMinutes) {
        await chrome.alarms.create(CHECK_ALARM, { delayInMinutes: 1, periodInMinutes });
    }
}

/** Only what the CMC page needs — the bot token and chat id never leave the worker. */
async function getPageSettings(): Promise<PageSettings> {
    const { excludedPortfolios, portfolioExchanges } = await getSettings();
    return { excludedPortfolios, portfolioExchanges };
}

async function notifyCmcTabs() {
    const tabs = await chrome.tabs.query({ url: 'https://coinmarketcap.com/*' });

    tabs.forEach((tab) => {
        if (tab.id !== undefined) {
            // Tabs without the content script (not loaded yet) just reject; nothing to update there.
            chrome.tabs.sendMessage(tab.id, { type: PAGE_SETTINGS_CHANGED_MESSAGE }).catch(() => {});
        }
    });
}

export default defineBackground(() => {
    chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
        if (message?.type === FETCH_MESSAGE) {
            const { url, init } = message as FetchRequest;
            fetchDirect(url, init).then(sendResponse);
            return true; // async response
        }

        if (message?.type === CHECK_NOW_MESSAGE) {
            checkRates().then(sendResponse);
            return true;
        }

        if (message?.type === PORTFOLIO_MESSAGE) {
            rememberPortfolioSymbols((message as PortfolioMessage).symbols);
            return false;
        }

        if (message?.type === PORTFOLIO_NAMES_MESSAGE) {
            const { names } = message as PortfolioNamesMessage;

            if (Array.isArray(names) && names.every((name) => typeof name === 'string')) {
                knownPortfoliosItem.setValue(names);
            }

            return false;
        }

        if (message?.type === HOLDINGS_MESSAGE) {
            const { holdings } = message as HoldingsMessage;

            if (holdings && typeof holdings === 'object') {
                holdingsItem.setValue(holdings);
            }

            return false;
        }

        if (message?.type === BINGX_PRODUCTS_MESSAGE) {
            saveBingxProducts((message as BingxProductsMessage).result);
            return false;
        }

        if (message?.type === BINGX_REFRESH_MESSAGE) {
            refreshBingx().then(sendResponse);
            return true;
        }

        if (message?.type === BINGX_RATES_MESSAGE) {
            bingxRatesItem.getValue().then(sendResponse);
            return true;
        }

        if (message?.type === PAGE_SETTINGS_MESSAGE) {
            getPageSettings().then(sendResponse);
            return true;
        }

        return false;
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === CHECK_ALARM) {
            checkRates();
        }
    });

    chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

    settingsItem.watch(() => {
        scheduleCheck();
        notifyCmcTabs();
    });
    scheduleCheck();
});
