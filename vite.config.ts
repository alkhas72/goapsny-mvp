import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// П-22: единая точка входа — index.html → src/main.tsx → App.
// Прежний двойной бандл (отдельный public.html + public-main.tsx) снят:
// App сам детектит Telegram-окружение и переключается между TelegramApp
// и PublicApp. Второй вход был переходной формой и больше не нужен.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
