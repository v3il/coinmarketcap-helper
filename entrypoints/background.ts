import { CHECK_NOW_MESSAGE, PORTFOLIO_MESSAGE, type PortfolioMessage } from '@/lib/messages';
import { checkRates } from '@/lib/notifier';
import { rememberPortfolioSymbols } from '@/lib/portfolio';
import { settingsItem } from '@/lib/storage';
import { FETCH_MESSAGE, fetchDirect, type FetchRequest } from '@/utils/request';

const CHECK_ALARM = 'check-rates';

async function scheduleCheck() {
    const { intervalHours } = await settingsItem.getValue();
    const periodInMinutes = Math.max(1, intervalHours) * 60;
    const existing = await chrome.alarms.get(CHECK_ALARM);

    if (existing?.periodInMinutes !== periodInMinutes) {
        await chrome.alarms.create(CHECK_ALARM, { delayInMinutes: 1, periodInMinutes });
    }
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

        return false;
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === CHECK_ALARM) {
            checkRates();
        }
    });

    chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

    settingsItem.watch(() => scheduleCheck());
    scheduleCheck();
});
