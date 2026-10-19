import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardVariantFromSearch, externalLinks, routeLinks, sharePlace } from './placeLinks';
import { accessHighlights, type HighlightSource } from './accessText';

const NOTHING: HighlightSource = {
  stepsCount: null,
  stepHeightCm: null,
  rampType: 'none',
  doorWidthCm: null,
  toiletExists: 'unknown',
  toiletAccessible: 'unknown',
  parking: 'unknown',
  details: {},
};

const texts = (source: Partial<HighlightSource>) => accessHighlights({ ...NOTHING, ...source }).map((item) => item.text);

describe('accessHighlights', () => {
  it('gives nothing when nothing is recorded', () => {
    expect(texts({})).toEqual([]);
  });

  it('tells null steps from zero steps', () => {
    expect(texts({ stepsCount: null })).toEqual([]);
    expect(texts({ stepsCount: 0 })).toEqual(['Без ступеней']);
    expect(texts({ stepsCount: 3, stepHeightCm: 16 })).toEqual(['3 ступени по 16 см']);
    expect(texts({ stepsCount: 1 })).toEqual(['1 ступень']);
  });

  it('keeps toilet partial, unknown and no apart', () => {
    expect(texts({ toiletExists: 'yes', toiletAccessible: 'yes' })).toEqual(['Доступный туалет']);
    expect(texts({ toiletExists: 'yes', toiletAccessible: 'partial' })).toEqual(['Туалет частично доступен']);
    expect(texts({ toiletExists: 'yes', toiletAccessible: 'no' })).toEqual(['Туалет недоступен']);
    expect(texts({ toiletExists: 'yes', toiletAccessible: 'unknown' })).toEqual([]);
    expect(texts({ toiletExists: 'unknown', toiletAccessible: 'yes' })).toEqual([]);
  });

  it('marks portable ramps and puts the entrance first, three at most', () => {
    const items = accessHighlights({
      ...NOTHING,
      stepsCount: 3,
      stepHeightCm: 16,
      rampType: 'portable_on_request',
      doorWidthCm: 95,
      toiletExists: 'yes',
      toiletAccessible: 'yes',
      parking: 'yes',
    });
    expect(items.map((item) => item.text)).toEqual(['3 ступени по 16 см', 'Пандус по запросу', 'Дверь 95 см']);
    expect(items[1].portableRamp).toBe(true);
  });

  it('does not count a zero door width as unknown', () => {
    expect(texts({ doorWidthCm: 0 })).toEqual(['Дверь 0 см']);
  });
});

describe('routeLinks', () => {
  it('puts the coordinates into every app link, Yandex first', () => {
    const links = routeLinks(43.0021, 41.0189);
    expect(links.map((link) => link.id)).toEqual(['yandex', 'google', 'apple']);
    expect(links[0].href).toBe('https://yandex.ru/maps/?rtext=~43.0021,41.0189&rtt=pd');
    expect(links[1].href).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=43.0021,41.0189&travelmode=walking',
    );
    expect(links[2].href).toBe('https://maps.apple.com/?daddr=43.0021,41.0189&dirflg=w');
  });
});

describe('externalLinks', () => {
  it('lists only present http links, Yandex first', () => {
    const links = externalLinks({ osm: 'https://osm.org/node/1', yandex: 'https://yandex.ru/maps/org/1', apple: 'javascript:alert(1)' });
    expect(links.map((link) => link.short)).toEqual(['Яндекс', 'OSM']);
  });

  it('is empty without links', () => {
    expect(externalLinks(undefined)).toEqual([]);
    expect(externalLinks({})).toEqual([]);
  });
});

describe('sharePlace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const data = { title: 'Аптека', text: 'Аптека · Частично', url: 'https://goapsny.example/' };

  it('uses the system share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    await expect(sharePlace(data)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('treats a dismissed share sheet as cancelled, without copying', async () => {
    const abort = Object.assign(new Error('dismissed'), { name: 'AbortError' });
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(abort), clipboard: { writeText } });
    await expect(sharePlace(data)).resolves.toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the link when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(sharePlace(data)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://goapsny.example/');
  });
});

describe('cardVariantFromSearch', () => {
  it('reads ?card=b and defaults to a', () => {
    expect(cardVariantFromSearch('')).toBe('a');
    expect(cardVariantFromSearch('?card=b')).toBe('b');
    expect(cardVariantFromSearch('?card=B&x=1')).toBe('b');
    expect(cardVariantFromSearch('?card=z')).toBe('a');
  });
});
