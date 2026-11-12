export function onTableReady(callback: (el: HTMLTableElement) => void) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((record) => {
            record.addedNodes.forEach((node) => {
                if (node.nodeType !== 1) {
                    return;
                }

                const el: HTMLElement = node as HTMLElement;
                const tableEl = el.querySelector<HTMLTableElement>('.portfolio-tablelist-wrapper .cmc-table');

                if (tableEl) {
                    callback(tableEl);
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const tableEl = document.querySelector<HTMLTableElement>('.portfolio-tablelist-wrapper .cmc-table');

    if (tableEl) {
        callback(tableEl);
    }
}
