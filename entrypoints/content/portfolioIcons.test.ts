import { describe, expect, it } from 'vitest';
import { renderRowIcons } from './portfolioIcons';

/** Just what the icon code touches on an <img>. */
class FakeImg {
    attrs: Record<string, string> = {};

    dataset: Record<string, string | undefined> = {};

    classes = new Set<string>();

    classList = {
        add: (name: string) => this.classes.add(name),
        remove: (name: string) => this.classes.delete(name)
    };

    constructor(src: string) {
        this.attrs.src = src;
    }

    getAttribute(name: string) {
        return this.attrs[name] ?? null;
    }

    setAttribute(name: string, value: string) {
        this.attrs[name] = value;
    }
}

const asImgs = (imgs: FakeImg[]) => imgs as unknown as HTMLImageElement[];
const iconOf = (name: string) => `logo:${name}`;

describe('renderRowIcons', () => {
    it('puts each portfolio logo on its avatar, in order', () => {
        const imgs = [new FakeImg('avatar-a'), new FakeImg('avatar-b')];
        renderRowIcons(asImgs(imgs), ['Binance', 'OKX'], iconOf);
        expect(imgs.map((img) => img.attrs.src)).toEqual(['logo:Binance', 'logo:OKX']);
    });

    it('gives CMC its avatars back when the row no longer matches the data', () => {
        const imgs = [new FakeImg('avatar-a'), new FakeImg('avatar-b')];
        renderRowIcons(asImgs(imgs), ['Binance', 'OKX'], iconOf);

        renderRowIcons(asImgs(imgs), ['Binance', 'OKX', 'MEXC'], iconOf);
        expect(imgs.map((img) => img.attrs.src)).toEqual(['avatar-a', 'avatar-b']);

        renderRowIcons(asImgs(imgs), undefined, iconOf);
        expect(imgs.map((img) => img.attrs.src)).toEqual(['avatar-a', 'avatar-b']);
    });
});
