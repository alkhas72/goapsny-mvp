import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const PUBLIC_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const

// Превью-сборки Vercel (ветки и PR) не получают переменных окружения боевого
// проекта и открывались с ошибкой «Нет конфигурации Supabase». Для них, и только
// для них, берём публичные значения из `.env.development` — те же, что уже лежат
// в бандле map.goapsny.org. Боевую сборку это не затрагивает.
function previewDefine(): Record<string, string> {
  if (process.env.VERCEL_ENV !== 'preview') return {}
  const dev = loadEnv('development', process.cwd(), 'VITE_')
  const define: Record<string, string> = {}
  for (const key of PUBLIC_KEYS) {
    if (!process.env[key] && dev[key]) {
      define[`import.meta.env.${key}`] = JSON.stringify(dev[key])
    }
  }
  return define
}

// П-22: единая точка входа — index.html → src/main.tsx → App.
// Прежний двойной бандл (отдельный public.html + public-main.tsx) снят:
// App сам детектит Telegram-окружение и переключается между TelegramApp
// и PublicApp. Второй вход был переходной формой и больше не нужен.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: previewDefine(),
})
