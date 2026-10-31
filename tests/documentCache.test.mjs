import test from 'node:test'
import assert from 'node:assert/strict'
import {createDocumentCache} from '../src/lib/documentCache.js'
test('library survives page remounts and coalesces overlapping loads',async()=>{
 let calls=0,release
 const cache=createDocumentCache(()=>{calls++;return new Promise(resolve=>{release=resolve})})
 const a=cache.loadLibrary(),b=cache.loadLibrary()
 release({documents:[{filename:'guide.pdf'}]})
 await Promise.all([a,b])
 assert.equal(calls,1)
 assert.deepEqual(cache.library(),[{filename:'guide.pdf'}])
})
test('unchanged refresh retains the same library reference',async()=>{
 const cache=createDocumentCache(async()=>({documents:[{filename:'guide.pdf'}]}))
 const first=await cache.loadLibrary()
 assert.equal(await cache.loadLibrary(),first)
})
test('cached source is reused and status changes preserve content',async()=>{
 let calls=0
 const cache=createDocumentCache(async()=>{calls++;return {chunks:[{id:1,content:'Original text',metadata:{active:true}}]}})
 await cache.loadSource('guide.pdf');await cache.loadSource('guide.pdf')
 assert.equal(calls,1)
 cache.setSourceActive('guide.pdf',false)
 assert.equal(cache.source('guide.pdf')[0].content,'Original text')
 assert.equal(cache.source('guide.pdf')[0].metadata.active,false)
 cache.clearSources();await cache.loadSource('guide.pdf')
 assert.equal(calls,2)
})

test('fresh library does not fetch again; explicit mutations can force a refresh',async()=>{
 let calls=0
 const cache=createDocumentCache(async()=>{calls++;return {documents:[{filename:'guide.pdf'}]}})
 await cache.loadLibrary();await cache.loadLibrary()
 assert.equal(calls,1)
 await cache.loadLibrary({force:true})
 assert.equal(calls,2)
})

test('expired cache revalidates without clearing visible documents',async()=>{
 let now=0,calls=0
 const cache=createDocumentCache(async()=>{calls++;return {documents:[{filename:'guide.pdf'}]}},{ttl:100,clock:()=>now})
 const first=await cache.loadLibrary();now=101
 assert.equal(cache.library(),first)
 assert.equal(await cache.loadLibrary(),first)
 assert.equal(calls,2)
})
