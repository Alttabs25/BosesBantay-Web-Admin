import { documentRequest } from './documentAdmin'

export function createOverviewCache(request) {
  let data=null,pending=null,dirty=true,version=0
  return {
    value:()=>data,
    dirty:()=>dirty,
    invalidate(){dirty=true;version++},
    load(){
      if(pending)return pending
      if(data!==null&&!dirty)return Promise.resolve(data)
      const started=version
      pending=request('/chatbot/overview').then(result=>{
        if(JSON.stringify(result)!==JSON.stringify(data))data=result
        dirty=version!==started
        return data
      }).finally(()=>{pending=null})
      return pending
    },
  }
}
export const overviewCache=createOverviewCache(documentRequest)
export function invalidateOverview(){
  overviewCache.invalidate()
  window.dispatchEvent(new Event('bb:overview-changed'))
}
