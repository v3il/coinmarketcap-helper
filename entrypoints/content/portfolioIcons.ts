// Exchange / wallet logos instead of CMC's portfolio avatars: in the sidebar (each item has the portfolio's name) and
// in the overview table's avatar stacks (no names there, but the stack follows CMC's order of the coin's portfolios).
// Only img.src changes; the original is kept on the img and restored when the setting is off.

const AVATAR_SELECTOR = 'img[alt="portfolio-avator"]';
const SIDEBAR_ITEM_SELECTOR = '[data-rbd-draggable-id]';
const LOGO_CLASS = 'cmc-helper-logo';

export interface PortfolioIconsOptions {
    enabled: boolean;
    /** Portfolio name -> icon URL. */
    iconOf: (portfolio: string) => string;
    /** Lower-case symbol -> the coin's portfolios in CMC's order; null until loaded. */
    order: Map<string, string[]> | null;
}

function setIcon(img: HTMLImageElement, icon: string) {
    // CMC set a new src (or we never touched it): that's the avatar to restore later.
    if (img.getAttribute('src') !== img.dataset.cmcHelperIcon) {
        img.dataset.cmcHelperAvatar = img.getAttribute('src') ?? '';
    }

    if (img.getAttribute('src') !== icon) {
        img.setAttribute('src', icon);
    }

    img.dataset.cmcHelperIcon = icon;
    img.classList.add(LOGO_CLASS);
}

function restore(img: HTMLImageElement) {
    const avatar = img.dataset.cmcHelperAvatar;

    // CMC replaced the src meanwhile: keep its own.
    if (avatar !== undefined && img.getAttribute('src') === img.dataset.cmcHelperIcon) {
        img.setAttribute('src', avatar);
    }

    delete img.dataset.cmcHelperAvatar;
    delete img.dataset.cmcHelperIcon;
    img.classList.remove(LOGO_CLASS);
}

export function renderPortfolioIcons({ enabled, iconOf, order }: PortfolioIconsOptions) {
    if (!enabled) {
        document.querySelectorAll<HTMLImageElement>(`img.${LOGO_CLASS}`).forEach(restore);
        return;
    }

    document.querySelectorAll(SIDEBAR_ITEM_SELECTOR).forEach((item) => {
        const name = item.querySelector('.name')?.textContent?.trim();
        const img = item.querySelector<HTMLImageElement>(AVATAR_SELECTOR);

        if (name && img) {
            setIcon(img, iconOf(name));
        }
    });

    document.querySelectorAll('table tbody tr').forEach((row) => {
        const symbol = row.querySelector('.symbol-name')?.textContent?.trim().toLowerCase();
        const names = symbol ? order?.get(symbol) : undefined;
        renderRowIcons([...row.querySelectorAll<HTMLImageElement>(AVATAR_SELECTOR)], names, iconOf);
    });
}

/** One table row's avatar stack: logos in the data's order, or CMC's avatars back when the row doesn't match it. */
export function renderRowIcons(
    imgs: HTMLImageElement[],
    names: string[] | undefined,
    iconOf: (name: string) => string
) {
    if (!names || names.length !== imgs.length) {
        imgs.filter((img) => img.dataset.cmcHelperAvatar !== undefined).forEach(restore);
        return;
    }

    imgs.forEach((img, index) => setIcon(img, iconOf(names[index])));
}
