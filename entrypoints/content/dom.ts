type Child = Node | string | null | undefined | false;

/** Minimal hyperscript helper: h('div', { class: 'x' }, child1, 'text', ...). */
export function h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    ...children: Child[]
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);

    Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
    el.append(...children.filter((child): child is Node | string => child != null && child !== false));

    return el;
}
