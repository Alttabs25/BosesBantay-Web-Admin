import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const original = await readFile(new URL('../src/lib/documentAdmin.js', import.meta.url), 'utf8')
const source = original.replace(/^const base = .*$/m, "const base = '/api/document-admin'")
let sequence = 0
async function client(responses) {
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push(options); const result = responses.shift(); return { status: result.status, ok: result.status === 200, json: async () => result.body } }
  const module = await import(`data:text/javascript,${encodeURIComponent(source)}#${sequence++}`)
  return { module, calls }
}
test('local document request needs no separate Supabase session', async () => {
  const { module, calls } = await client([{ status: 200, body: { documents: [] } }])
  assert.deepEqual(await module.documentRequest('/documents'), { documents: [] })
  assert.equal(calls[0].headers.Authorization, undefined)
})
test('denied request is not replayed or treated as an expired login', async () => {
  const { module, calls } = await client([{ status: 403, body: { error: 'Local access only' } }])
  await assert.rejects(module.documentRequest('/index', { filename: 'sample.txt' }), /Local access only/)
  assert.equal(calls.length, 1)
})
