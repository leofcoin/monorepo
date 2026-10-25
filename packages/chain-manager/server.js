import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/manager.js', ['manager.js', 'text/javascript; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
])

export function createAppServer() {
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed')
      return
    }
    const pathname = new URL(request.url, 'http://localhost').pathname
    const asset = assets.get(pathname) || (/^\/(?:chunk-[A-Z0-9]+|operator|presence|genesis|templates)\.js$/.test(pathname)
      ? [pathname.slice(1), 'text/javascript; charset=utf-8'] : undefined)
    if (!asset) {
      response.writeHead(404).end('Not found')
      return
    }
    try {
      const body = await readFile(new URL(`dist/${asset[0]}`, import.meta.url))
      response.writeHead(200, {
        'Content-Type': asset[1],
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      }).end(request.method === 'HEAD' ? undefined : body)
    } catch (error) {
      console.error('Unable to serve Chain Manager asset:', error)
      response.writeHead(500).end('Build the app with npm run build -w @leofcoin/chain-manager first')
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 9580)
  const server = createAppServer()
  server.on('error', error => {
    console.error('Chain Manager server failed:', error)
    process.exitCode = 1
  })
  server.listen(port, '127.0.0.1', () => console.log(`Chain Manager: http://127.0.0.1:${port}`))
}
