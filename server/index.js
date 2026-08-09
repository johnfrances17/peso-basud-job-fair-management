import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createServer as createViteServer } from 'vite'
import app from './app.js'

const port = Number(process.env.PORT ?? 3001)
const isProduction = process.env.NODE_ENV === 'production'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', 'dist')

async function startServer() {
  const distIndex = path.join(distDir, 'index.html')

  if (isProduction && existsSync(distIndex)) {
    app.use(express.static(distDir))
    // SPA fallback for client-side routes (Express 5-safe, no '*' wildcard).
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api/')) {
        next()
        return
      }

      response.sendFile(distIndex)
    })
  } else {
    if (isProduction) {
      console.warn('[server] dist/index.html not found — falling back to Vite dev middleware.')
    }

    const vite = await createViteServer({
      appType: 'spa',
      server: {
        middlewareMode: true,
      },
    })

    app.use(vite.middlewares)
  }

  app.listen(port, () => {
    console.log(`Basud app running on http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start the server.', error)
  process.exit(1)
})
