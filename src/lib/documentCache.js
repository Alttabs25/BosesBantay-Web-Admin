export function createDocumentCache(request, { ttl = 5 * 60 * 1000, clock = Date.now } = {}) {
  let library = null
  let pendingLibrary = null
  let loadedAt = 0
  const sources = new Map()
  const pendingSources = new Map()
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b)
  return {
    library: () => library,
    async loadLibrary({ force = false } = {}) {
      if (force && pendingLibrary) await pendingLibrary.catch(() => {})
      if (!force && library !== null && clock() - loadedAt < ttl) return library
      if (!pendingLibrary) pendingLibrary = request('/documents').then(result => { if (!same(library,result.documents)) library=result.documents; loadedAt=clock(); return library }).finally(()=>{pendingLibrary=null})
      return pendingLibrary
    },
    source: filename => sources.get(filename) || null,
    async loadSource(filename) {
      if (sources.has(filename)) return sources.get(filename)
      if (!pendingSources.has(filename)) pendingSources.set(filename,request('/source',{filename}).then(result=>{
        // Avoid keeping unusually large source bodies indefinitely.
        if (JSON.stringify(result.chunks).length <= 500000) {
          if(sources.size>=8)sources.delete(sources.keys().next().value)
          sources.set(filename,result.chunks)
        }
        return result.chunks
      }).finally(()=>{pendingSources.delete(filename)}))
      return pendingSources.get(filename)
    },
    setSourceActive(filename,active) {
      if(sources.has(filename))sources.set(filename,sources.get(filename).map(chunk=>({...chunk,metadata:{...chunk.metadata,active}})))
    },
    clearSources() { sources.clear() },
  }
}
