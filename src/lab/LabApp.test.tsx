import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./LabViewport', () => ({ LabViewport: ({ onBounds, onPhase }: { onBounds: (b: { west: number; south: number; east: number; north: number }) => void; onPhase: (p: 'ready') => void }) => {
  useEffect(() => { onBounds({ west: 41, east: 41.04, south: 43, north: 43.01 }); onPhase('ready'); }, [onBounds, onPhase]);
  return <div>Viewport adapter</div>;
} }));
import { LabApp } from './LabApp';
afterEach(cleanup);
it('restores marks on reload and preserves checked status through the shell', () => {
  const view = render(<LabApp />);
  const opener = screen.getByRole('button', { name: 'Демо: вход А (вымышленный) · Доступно' });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button', { name: 'Недоступно' }));
  expect(screen.getByText('Проверенный статус: Доступно')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' });
  expect(document.activeElement).toBe(opener);
  view.unmount();
  render(<LabApp />);
  fireEvent.click(screen.getByRole('button', { name: 'Мои отметки (1)' }));
  expect(screen.getByText(/Предложение: Недоступно/)).toBeTruthy();
});
import { LabIntegrationSheet } from './LabIntegrationSheet';
import { createLabStore } from './store';
import type { LabPlace } from './contract';
it('submits a proposal without mutating the checked place, reports duplicate and returns focus', () => {
  const place = { id: 'demo', name: 'Демо', status: 'green' } as LabPlace;
  const close = vi.fn();
  render(<LabIntegrationSheet place={place} onClose={close} onSubmit={createLabStore().save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Недоступно' }));
  expect(place.status).toBe('green');
  expect(screen.getByText('Проверенный статус: Доступно')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Недоступно' }));
  expect(within(screen.getByRole('status')).getByText('Эта отметка уже сохранена.')).toBeTruthy();
  expect(createLabStore().load().items).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});
