import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CircleAlert, CircleCheck, FileText, Layers3, MessageCircleQuestion, RotateCw } from 'lucide-react'
import { overviewCache } from '../lib/overviewCache'
import './BotOverview.css'

export default function BotOverview({active,onAsk,disabled}) {
  const [data,setData]=useState(()=>overviewCache.value()), [error,setError]=useState('')
  useEffect(()=>{
    if(!active)return
    let disposed=false
    async function load(){try{const result=await overviewCache.load();if(disposed)return;setData(previous=>previous===result?previous:result);setError('');if(overviewCache.dirty())load()}catch(failure){if(!disposed)setError(failure.message)}}
    load();window.addEventListener('bb:overview-changed',load)
    return()=>{disposed=true;window.removeEventListener('bb:overview-changed',load)}
  },[active])
  const coverage=data?.coverage
  const ready=Boolean(coverage?.available&&data?.ingestion?.enabled&&!data?.ingestion?.busy&&coverage.active>0)
  const statusText=!data?'Checking':ready?'Ready':data.ingestion?.busy?'Indexing':!data.ingestion?.enabled?'Paused':'Needs attention'
  const statusDetail=!data?'Loading chatbot information':!coverage?.available?'Knowledge base could not be reached':data.ingestion.busy?'Documents are being indexed':!data.ingestion.enabled?'Document indexing is paused':coverage.active===0?'Add an active document to support answers':'Documents are available to answer questions'
  return <aside className="bo-redesign" aria-label="Chatbot overview">
    <header className="bo-redesign-head">
      <div className="bo-brand-mark" aria-hidden="true"><MessageCircleQuestion size={19}/></div>
      <div className="bo-head-copy"><span className="bo-kicker">BARANGAY BOT</span><h2>Overview</h2><p>Knowledge base and questions to review</p></div>
      <span className={`bo-state ${ready?'bo-state-ready':data?'bo-state-attention':'bo-state-loading'}`}>{ready?<CircleCheck size={14}/>:<CircleAlert size={14}/>} {statusText}</span>
    </header>
    <div className={`bo-status-line ${ready?'is-ready':''}`} aria-live="polite"><span className="bo-status-indicator"/><p>{statusDetail}</p><Link to="/services" aria-label="View service controls"><ArrowUpRight size={15}/></Link></div>

    <section className="bo-library" aria-labelledby="bo-library-title">
      <div className="bo-section-title"><div><span className="bo-section-kicker">KNOWLEDGE</span><h3 id="bo-library-title">Document library</h3></div><Link to="/knowledge-base">Manage <ArrowUpRight size={14}/></Link></div>
      {!data?<p className="bo-loading">Loading document summary…</p>:!coverage?.available?<p className="bo-loading">Document summary is unavailable.</p>:<>
        <div className="bo-metrics">
          <div className="bo-metric bo-metric-primary"><span className="bo-metric-icon"><FileText size={16}/></span><strong>{coverage.active}</strong><span>Active documents</span></div>
          <div className="bo-metric"><span className="bo-metric-icon"><Layers3 size={16}/></span><strong>{coverage.chunks}</strong><span>Searchable chunks</span></div>
        </div>
        <div className="bo-library-foot"><span>{coverage.inactive} inactive</span><i aria-hidden="true"/><span>Uploads {data.ingestion.busy?'processing':data.ingestion.enabled?'enabled':'paused'}</span></div>
      </>}
    </section>

    <section className="bo-review" aria-labelledby="bo-review-title">
      <div className="bo-section-title bo-review-title"><div><span className="bo-section-kicker">FOLLOW UP</span><h3 id="bo-review-title">Questions to review</h3></div><span className="bo-review-count">{data?data.unanswered.length:'—'}</span></div>
      <p className="bo-review-hint">No supporting information was found for these admin questions.</p>
      {data?.unanswered.length>0?<ul className="bo-question-list">{data.unanswered.map(item=><li className="bo-question" key={item.id}><div className="bo-question-copy"><p>{item.question}</p><time dateTime={new Date(item.created_at*1000).toISOString()}>{new Date(item.created_at*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></div><button type="button" disabled={disabled} onClick={()=>onAsk(item.question)} aria-label={`Ask again: ${item.question}`}><RotateCw size={15}/><span>Ask again</span></button></li>)}</ul>:<div className="bo-review-empty"><span className="bo-empty-check"><CircleCheck size={17}/></span><div><strong>{data?'All caught up':'Loading questions…'}</strong><p>{data?'New questions needing document support will appear here.':''}</p></div></div>}
      <details className="bo-retention"><summary>About this list</summary><p>Admin chats only · Last 30 days · Up to 10 recent questions. Service errors are excluded; up to 200 entries are stored locally. Avoid entering personal details.</p></details>
    </section>
    {error&&<p className="bo-error" role="alert">Overview could not refresh. {error}</p>}
  </aside>
}
