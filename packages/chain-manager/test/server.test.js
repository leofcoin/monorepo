import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { createAppServer } from '../server.js'

test('standalone server serves the app and never exposes source or filesystem paths', async t => {
  const server = createAppServer().listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const index = await fetch(base)
  assert.equal(index.status, 200)
  assert.match(await index.text(), /<chain-manager-app>/)
  for (const [path, contentType] of [['/app.js', 'text/javascript'], ['/manager.js', 'text/javascript'], ['/style.css', 'text/css']]) {
    const response = await fetch(base + path)
    assert.equal(response.status, 200)
    assert.ok(response.headers.get('content-type').startsWith(contentType))
    assert.ok((await response.text()).length > 0)
  }
  for (const path of ['/package.json', '/src/manager.ts', '/electron/main.js', '/%2e%2e/package.json']) {
    assert.equal((await fetch(base + path)).status, 404)
  }
  assert.equal((await fetch(base, { method: 'POST' })).status, 405)
  const head = await fetch(base, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
})
