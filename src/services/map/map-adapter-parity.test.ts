import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMemoryMapAdapter,
  createResizeObserverStub,
  type MemoryMapAdapterExtras,
} from './test-support/memory-adapter';
import { makePlace } from './test-support/factories';
import type { MapAdapter } from './types';

function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const resizeStub = createResizeObserverStub();
  const onSelectPlace = vi.fn();
  const onClearSelection = vi.fn();
  const onMarkerButton = vi.fn();
  const onError = vi.fn();
  const onNetworkChange = vi.fn();

  const adapter = createMemoryMapAdapter({
    onSelectPlace,
    onClearSelection,
    onMarkerButton,
    onError,
    onNetworkChange,
    createResizeObserver: resizeStub.factory,
  }) as MapAdapter & MemoryMapAdapterExtras;

  return {
    container,
    adapter,
    resizeStub,
    onSelectPlace,
    onClearSelection,
    onMarkerButton,
    onError,
    onNetworkChange,
  };
}

describe('MapAdapter parity', () => {
  let harness: ReturnType<typeof setup>;

  beforeEach(() => {
    harness = setup();
  });

  afterEach(() => {
    harness.adapter.destroy();
    harness.container.remove();
  });

  describe('lifecycle', () => {
    it('mounts into a container and destroys cleanly', () => {
      const { adapter, container } = harness;
      expect(adapter.isMounted).toBe(false);

      adapter.mount(container);
      expect(adapter.isMounted).toBe(true);
      expect(container.querySelector('.map-tile-layer')).toBeTruthy();
      expect(container.querySelector('.map-marker-layer')).toBeTruthy();
      expect(container.classList.contains('map-adapter-container')).toBe(true);

      adapter.destroy();
      expect(adapter.isMounted).toBe(false);
      expect(container.innerHTML).toBe('');
    });

    it('applies theme to container and updates it', () => {
      const { adapter, container } = harness;
      adapter.mount(container);
      expect(container.getAttribute('data-theme')).toBe('dark');

      adapter.setTheme('light');
      expect(container.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('markers', () => {
    it('renders a marker button for each place with the shared DOM contract', () => {
      const { adapter, container } = harness;
      adapter.mount(container);
      adapter.setPlaces([
        makePlace({ id: 'p1', name: 'Cafe', status: 'green', rampType: 'permanent' }),
        makePlace({ id: 'p2', name: 'Shop', status: 'gray' }),
      ]);

      const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.map-pin-button'));
      expect(buttons.map((button) => button.dataset.placeId)).toEqual(['p1', 'p2']);

      const cafe = buttons.find((button) => button.dataset.placeId === 'p1')!;
      expect(cafe.getAttribute('aria-label')).toContain('Cafe');
      expect(cafe.getAttribute('aria-label')).toContain('Доступно');
      expect(cafe.querySelector('svg path')?.getAttribute('fill')).toBe('#2EA84A');
    });

    it('reflects selected place with is-selected class', () => {
      const { adapter, container } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1' }), makePlace({ id: 'p2' })], 'p2');

      const selected = container.querySelector('.map-pin-button.is-selected');
      expect(selected?.getAttribute('data-place-id')).toBe('p2');
    });

    it('uses purple center for portable ramp on green or yellow', () => {
      const { adapter, container } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1', status: 'green', rampType: 'portable_available' })]);

      const circle = container.querySelector('svg circle');
      expect(circle?.getAttribute('fill')).toBe('#7A5AF8');
    });

    it('updates markers when places list changes', () => {
      const { adapter, container, onMarkerButton } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1' }), makePlace({ id: 'p2' })]);
      expect(container.querySelectorAll('.map-pin-button').length).toBe(2);

      onMarkerButton.mockClear();
      adapter.setPlaces([makePlace({ id: 'p2' })]);
      expect(container.querySelectorAll('.map-pin-button').length).toBe(1);
      expect(onMarkerButton).toHaveBeenCalledWith('p1', null);
    });

    it('clears all markers when places list is empty', () => {
      const { adapter, container } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1' }), makePlace({ id: 'p2' })]);
      adapter.setPlaces([]);
      expect(container.querySelectorAll('.map-pin-button').length).toBe(0);
    });
  });

  describe('keyboard activation', () => {
    it('activates a marker on click, Enter, or Space and stops propagation', () => {
      const { adapter, container, onSelectPlace } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1' }), makePlace({ id: 'p2' })]);

      const button = container.querySelector<HTMLButtonElement>('[data-place-id="p1"]')!;
      const propagated = vi.fn();
      container.addEventListener('click', propagated);

      button.click();
      expect(onSelectPlace).toHaveBeenCalledWith('p1');
      expect(propagated).not.toHaveBeenCalled();

      onSelectPlace.mockClear();
      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      button.dispatchEvent(enter);
      expect(onSelectPlace).toHaveBeenCalledWith('p1');
      expect(enter.defaultPrevented).toBe(true);

      onSelectPlace.mockClear();
      const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      button.dispatchEvent(space);
      expect(onSelectPlace).toHaveBeenCalledWith('p1');
      expect(space.defaultPrevented).toBe(true);
    });

    it('does not activate a marker for unrelated keys', () => {
      const { adapter, container, onSelectPlace } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1' })]);

      const button = container.querySelector<HTMLButtonElement>('[data-place-id="p1"]')!;
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(onSelectPlace).not.toHaveBeenCalled();
    });

    it('clears selection when clicking outside markers', () => {
      const { adapter, container, onClearSelection } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1' })]);

      container.click();
      expect(onClearSelection).toHaveBeenCalled();
    });
  });

  describe('focus return', () => {
    it('reports marker button references when rendered and when removed', () => {
      const { adapter, container, onMarkerButton } = harness;
      adapter.mount(container);
      adapter.setPlaces([makePlace({ id: 'p1' }), makePlace({ id: 'p2' })]);

      expect(onMarkerButton).toHaveBeenCalledTimes(2);
      const p1Button = onMarkerButton.mock.calls.find(([id]) => id === 'p1')?.[1] as HTMLButtonElement;
      expect(p1Button).toBe(container.querySelector('[data-place-id="p1"]'));

      adapter.setPlaces([makePlace({ id: 'p2' })]);
      expect(onMarkerButton).toHaveBeenCalledWith('p1', null);
    });
  });

  describe('responsive behavior', () => {
    it('observes container resizes and disconnects on destroy', () => {
      const { adapter, container, resizeStub } = harness;
      adapter.mount(container);

      expect(resizeStub.observed).toContain(container);
      expect(() => resizeStub.fire()).not.toThrow();

      adapter.destroy();
      expect(resizeStub.observed).toHaveLength(0);
    });
  });

  describe('offline and error states', () => {
    it('surfaces tile errors through onError', () => {
      const { adapter, onError } = harness;
      adapter.mount(harness.container);

      adapter.simulateTileError('tiles');
      expect(onError).toHaveBeenCalledWith({
        kind: 'tile',
        sourceId: 'tiles',
        message: 'Tile source failed to load',
      });
    });

    it('tracks network status and notifies callbacks', () => {
      const { adapter, container, onNetworkChange } = harness;
      adapter.mount(container);

      adapter.setNetworkStatus('offline');
      expect(adapter.networkStatus).toBe('offline');
      expect(container.getAttribute('data-network')).toBe('offline');
      expect(onNetworkChange).toHaveBeenCalledWith(false);

      adapter.setNetworkStatus('online');
      expect(adapter.networkStatus).toBe('online');
      expect(container.getAttribute('data-network')).toBe('online');
      expect(onNetworkChange).toHaveBeenCalledWith(true);
    });
  });
});
