import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // tests/ — контрактные проверки миграций: статические утверждения по тексту
    // SQL, живая база им не нужна. Без этой строки они существовали, но никогда
    // не запускались, и «73/73 PASS» не включал контракт T2 вовсе.
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
