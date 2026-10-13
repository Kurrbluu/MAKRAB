import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'MAKRAB_')
  const gameServer = env.MAKRAB_GAME_SERVER ?? 'http://127.0.0.1:3000'
  const cloud = process.env.VERCEL === '1' || env.MAKRAB_ONLINE === '1'
  return {
    plugins: [react(), {
      name: 'makrab-shared-preview',
      transformIndexHtml: {
        order: 'pre',
        async handler() {
          if (cloud) return [{ tag: 'meta', attrs: { name: 'makrab-session', content: 'shared' }, injectTo: 'head-prepend' }]
          if (mode === 'production') return
          try {
            const response = await fetch(`${gameServer}/api/session`, { signal: AbortSignal.timeout(1000) })
            if (!response.ok) return
            const snapshot = await response.json()
            if (snapshot?.state?.version !== 1 || typeof snapshot.state.gameId !== 'string' || !Number.isFinite(snapshot.serverNow)) return
            return [{ tag: 'meta', attrs: { name: 'makrab-session', content: 'shared' }, injectTo: 'head-prepend' }]
          } catch { /* A preview without a game server keeps the standalone timer. */ }
        },
      },
    }],
    server: {
      proxy: { '/api': { target: gameServer, changeOrigin: false, xfwd: true } },
    },
  }
})
