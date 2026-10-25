import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep, extname } from 'node:path'

const root = resolve('www')
const fixture = resolve('test/wallet-ui-fixture.html')
const managerFixture = resolve('test/manager-ui-fixture.html')
const port = Number(process.env.UI_FIXTURE_PORT || 9556)
const types = {
  '.js': 'text/javascript',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
}
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
    const target = pathname === '/' ? fixture : pathname === '/manager' ? managerFixture : resolve(root, pathname.replace(/^\/+/, ''))
    if (target !== fixture && target !== managerFixture && !target.startsWith(root + sep)) {
      response.writeHead(403)
      response.end()
      return
    }
    const body = await readFile(target)
    response.writeHead(200, {
      'Content-Type': types[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`UI fixtures: http://127.0.0.1:${port} · manager: /manager (no real node or transactions)`)
)
