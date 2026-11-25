import { describe, expect, it } from 'vitest';
import { STOPGAP_URL, stopgapMeasurePointUrl, stopgapMeasureUrl, zamerEmbedUrl } from './stopgapLink';

const PLACE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Кафе «Пингвин»',
  lat: 43.00331234,
  lng: 41.0237,
  address: ' ул. Лакоба, 5 ',
};

describe('stopgapMeasureUrl', () => {
  it('собирает ссылку замера с местом и адресом возврата', () => {
    const url = new URL(
      stopgapMeasureUrl(PLACE, 'https://map.goapsny.org/?mapper=1', 'https://goapsny-stopgap.vercel.app/'),
    );
    expect(url.origin).toBe('https://goapsny-stopgap.vercel.app');
    expect(url.searchParams.get('measure')).toBe('1');
    expect(url.searchParams.get('place_id')).toBe(PLACE.id);
    expect(url.searchParams.get('name')).toBe('Кафе «Пингвин»');
    expect(url.searchParams.get('address')).toBe('ул. Лакоба, 5');
    expect(url.searchParams.get('lat')).toBe('43.003312');
    expect(url.searchParams.get('lng')).toBe('41.023700');
    expect(url.searchParams.get('return')).toBe('https://map.goapsny.org/?mapper=1');
  });

  it('без адреса и без https-возврата лишних параметров нет', () => {
    const url = new URL(
      stopgapMeasureUrl({ ...PLACE, address: null }, 'http://localhost:5199/', 'https://goapsny-stopgap.vercel.app/'),
    );
    expect(url.searchParams.has('address')).toBe(false);
    expect(url.searchParams.has('return')).toBe(false);
  });
});

describe('stopgapMeasurePointUrl', () => {
  it('замер в точке карты: координаты и возврат, без места', () => {
    const url = new URL(
      stopgapMeasurePointUrl(
        { lat: 43.00331234, lng: 41.0237 },
        'https://map.goapsny.org/?layer=ramps',
        'https://goapsny-stopgap.vercel.app/',
      ),
    );
    expect(url.searchParams.get('measure')).toBe('1');
    expect(url.searchParams.has('place_id')).toBe(false);
    expect(url.searchParams.get('lat')).toBe('43.003312');
    expect(url.searchParams.get('lng')).toBe('41.023700');
    expect(url.searchParams.get('return')).toBe('https://map.goapsny.org/?layer=ramps');
  });

  it('без точки открывает мастер без координат', () => {
    const url = new URL(stopgapMeasurePointUrl(null, null, 'https://goapsny-stopgap.vercel.app/'));
    expect(url.searchParams.get('measure')).toBe('1');
    expect(url.searchParams.has('lat')).toBe(false);
    expect(url.searchParams.has('return')).toBe(false);
  });
});

describe('мастер замера внутри карты', () => {
  it('по умолчанию ссылка ведёт в папку /zamer/ того же сайта', () => {
    const base = new URL(STOPGAP_URL);
    expect(base.origin).toBe(window.location.origin);
    expect(base.pathname).toBe('/zamer/');
    const url = new URL(stopgapMeasurePointUrl({ lat: 43, lng: 41 }, 'https://map.goapsny.org/?layer=ramps'));
    expect(url.pathname).toBe('/zamer/');
    expect(url.searchParams.get('measure')).toBe('1');
    expect(url.searchParams.get('return')).toBe('https://map.goapsny.org/?layer=ramps');
  });
});

describe('zamerEmbedUrl: мастер внутри карты', () => {
  const origin = 'https://map.goapsny.org';

  it('на нашем сайте: режим мастера, признак встроенности, настроение и точка', () => {
    const url = new URL(zamerEmbedUrl({ lat: 43.0015, lng: 41.0232 }, 'orchid', `${origin}/zamer/`, origin)!);
    expect(url.origin + url.pathname).toBe(`${origin}/zamer/`);
    expect(url.searchParams.get('mode')).toBe('wizard');
    expect(url.searchParams.get('embed')).toBe('1');
    expect(url.searchParams.get('measure')).toBe('1');
    expect(url.searchParams.get('mood')).toBe('orchid');
    expect(url.searchParams.get('lat')).toBe('43.001500');
    // Встроенному мастеру адрес возврата не нужен: карта остаётся под ним.
    expect(url.searchParams.has('return')).toBe(false);
  });

  it('отдельный Stopgap (откат): встроенного показа нет', () => {
    expect(zamerEmbedUrl({ lat: 43, lng: 41 }, 'sage', 'https://goapsny-stopgap.vercel.app/', origin)).toBeNull();
  });

  it('ссылка из карточки места на нашем сайте ведёт сразу в мастер', () => {
    const inside = new URL(stopgapMeasureUrl(PLACE, null, `${window.location.origin}/zamer/`));
    expect(inside.searchParams.get('mode')).toBe('wizard');
    const outside = new URL(stopgapMeasureUrl(PLACE, null, 'https://goapsny-stopgap.vercel.app/'));
    expect(outside.searchParams.has('mode')).toBe(false);
  });
});
