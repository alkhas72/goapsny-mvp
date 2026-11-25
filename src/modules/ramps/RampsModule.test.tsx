import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RampsModule from './RampsModule';

const WIZARD = `${window.location.origin}/zamer/?measure=1&lat=43.001500&lng=41.023200&mode=wizard&embed=1&mood=sage`;

function setup(wizardUrl: () => string | null = () => WIZARD) {
  const onMeasureOutside = vi.fn();
  const onLeave = vi.fn();
  render(<RampsModule showCross wizardUrl={wizardUrl} onMeasureOutside={onMeasureOutside} onLeave={onLeave} />);
  return { onMeasureOutside, onLeave, user: userEvent.setup() };
}

function frame(): HTMLIFrameElement {
  return screen.getByTitle('Мастер замера входа') as HTMLIFrameElement;
}

function tell(data: unknown, init: Partial<MessageEventInit> = {}) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: window.location.origin,
        source: frame().contentWindow,
        ...init,
      }),
    );
  });
}

describe('RampsModule: мастер замера внутри карты', () => {
  afterEach(cleanup);

  it('«Замерить вход здесь» открывает мастер в рамке, в режиме мастера', async () => {
    const { user, onMeasureOutside } = setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: /замерить вход здесь/i }));

    expect(screen.getByRole('dialog', { name: 'Замер входа' })).toBeTruthy();
    const src = new URL(frame().src);
    expect(src.pathname).toBe('/zamer/');
    expect(src.searchParams.get('mode')).toBe('wizard');
    expect(src.searchParams.get('embed')).toBe('1');
    // Камера, микрофон и место нужны мастеру внутри рамки.
    expect(frame().getAttribute('allow')).toContain('camera');
    expect(onMeasureOutside).not.toHaveBeenCalled();
  });

  it('мастер сообщил о закрытии: рамка убрана, человек снова на карте', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /замерить вход здесь/i }));
    tell({ stopgap: 'close' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Слой замеров')).toBeTruthy();
  });

  it('чужое сообщение мастер не закрывает', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /замерить вход здесь/i }));
    tell({ stopgap: 'close' }, { origin: 'https://evil.example' });
    tell({ stopgap: 'close' }, { source: window });
    tell({ stopgap: 'ready' });
    expect(screen.getByRole('dialog', { name: 'Замер входа' })).toBeTruthy();
  });

  it('откат на отдельный Stopgap: рамки нет, обычный переход', async () => {
    const { user, onMeasureOutside } = setup(() => null);
    await user.click(screen.getByRole('button', { name: /замерить вход здесь/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onMeasureOutside).toHaveBeenCalledTimes(1);
  });
});
