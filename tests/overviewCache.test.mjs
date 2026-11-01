import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// Use a data URL to test the store independently of Vite's request adapter.
const source=(await readFile(new URL('../src/lib/overviewCache.js',import.meta.url),'utf8')).replace("import { documentRequest } from './documentAdmin'",'const documentRequest=()=>{}')
const {createOverviewCache}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('navigation reuses overview; only invalidation requests fresh data',async()=>{
 let calls=0
 const cache=createOverviewCache(async()=>{calls++;return {coverage:{active:5}}})
 const first=await cache.load()
 assert.equal(await cache.load(),first);assert.equal(calls,1)
 cache.invalidate();assert.equal(await cache.load(),first);assert.equal(calls,2)
})
test('invalidation during lookup is retained and requests are coalesced',async()=>{
 let resolve,calls=0
 const cache=createOverviewCache(()=>{calls++;return new Promise(done=>{resolve=done})})
 const first=cache.load(),second=cache.load();cache.invalidate();resolve({coverage:{active:5}})
 await Promise.all([first,second]);assert.equal(calls,1);assert.equal(cache.dirty(),true)
})
