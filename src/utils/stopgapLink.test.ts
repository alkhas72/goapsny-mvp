import { describe, expect, it } from 'vitest';
import { stopgapMeasureUrl } from './stopgapLink';

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
