import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
const keyFolder = fileURLToPath(new URL('./services/document-admin/.private/', import.meta.url))
mkdirSync(keyFolder, { recursive: true })
const keyPath = keyFolder + '/local-proxy.key'
try { writeFileSync(keyPath, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }) } catch (error) { if (error.code !== 'EEXIST') throw error }
const proxyKey = readFileSync(keyPath, 'utf8').trim()

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'local-document-access',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/api/document-admin')) return next()
        const local = ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
        const origin = request.headers.origin
        const sameOrigin = !origin || origin === `http://${request.headers.host}` || origin === `https://${request.headers.host}`
        const site = request.headers['sec-fetch-site']
        if (!local || !sameOrigin || (site && !['same-origin','none'].includes(site))) {
          response.writeHead(403, { 'Content-Type': 'application/json' })
          return response.end(JSON.stringify({ error: 'Document management is available only from this computer’s localhost website.' }))
        }
        next()
      })
    },
  }],
  server: {
    open: true,
    proxy: {
      '/api/document-admin': {
        target: 'http://127.0.0.1:8766', changeOrigin: false,
        rewrite: path => path.replace(/^\/api\/document-admin/, ''),
        timeout: 960000, proxyTimeout: 960000,
        configure(proxy) {
          proxy.on('proxyReq', proxyRequest => { proxyRequest.setHeader('X-Document-Local-Key', proxyKey); proxyRequest.removeHeader('Authorization') })
        },
      },
    },
  },
})
