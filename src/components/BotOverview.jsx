import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { documentRequest } from '../lib/documentAdmin'
import './ServiceComplaintRegistry.css'
import './BotOverview.css'

export default function BotOverview({active,revision,onAsk,disabled}) {
  const [data,setData]=useState(null), [error,setError]=useState('')
  useEffect(()=>{
    if(!active)return
    let disposed=false, pending=false
    async function load(){
      if(pending||document.hidden)return
      pending=true
      try{const result=await documentRequest('/chatbot/overview');if(!disposed){setData(result);setError('')}}
      catch(failure){if(!disposed)setError(failure.message)}finally{pending=false}
    }
    load();const timer=setInterval(load,30000)
    document.addEventListener('visibilitychange',load)
    return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',load)}
  },[active,revision])
  const coverage=data?.coverage
  const categoryLabel=value=>({'Executive Order / Administrative Policy':'Executive orders & policies','Lokal na Ordinansa':'Local ordinances','Barangay Resolution':'Barangay resolutions','Citizens Charter / Clearance Requirements':"Citizen’s Charter & requirements"}[value]||value)
  return <aside className="bot-overview bo-complaint-style service-summary-panel" aria-label="Chatbot administration overview">
    <div className="service-summary-heading"><h2>Chatbot overview</h2></div>
    {error&&<p className="bo-load-error" role="alert">Could not update overview. {error}</p>}
    <section className="bo-documents"><header><h3>Knowledge sources</h3><Link to="/knowledge-base">Documents <ChevronRight size={13}/></Link></header><div className="bo-section-body">
      {!data?<p className="bo-muted">Loading sources…</p>:!coverage?.available?<p className="bo-muted">Document coverage could not be checked.</p>:<>
        <dl className="bo-document-totals"><div><dt>Active documents</dt><dd>{coverage.active}</dd></div><div><dt>Searchable chunks</dt><dd>{coverage.chunks}</dd></div></dl>
        <dl className="bo-document-details"><div><dt>Inactive documents</dt><dd>{coverage.inactive}</dd></div><div><dt>Document uploads</dt><dd className={data.ingestion.busy?'bo-processing':data.ingestion.enabled?'bo-upload-enabled':'bo-upload-paused'}>{data.ingestion.busy?'Indexing':data.ingestion.enabled?'Enabled':'Paused'}</dd></div></dl>
        {coverage.categories.length>0?<details className="bo-category-details" open><summary>Document categories <span>{coverage.categories.length}</span><ChevronRight size={13}/></summary><div className="bo-categories">{coverage.categories.map(category=><span key={category} title={category}>{categoryLabel(category)}</span>)}</div></details>:<p className="bo-muted">No categorized active sources yet.</p>}
      </>}
    </div></section>
    <section className="bo-inbox-section"><header><h3>Questions to review</h3><span className="bo-inbox-count">{data?data.unanswered.length:'—'}</span></header><div className="bo-section-body"><p className="bo-muted">Add supporting documents, then retry a question.</p>
      {data?.unanswered.length>0?<ul className="bo-questions">{data.unanswered.map(item=><li key={item.id}><p>{item.question}</p><div><time dateTime={new Date(item.created_at*1000).toISOString()}>Added {new Date(item.created_at*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time><button type="button" disabled={disabled} onClick={()=>onAsk(item.question)} aria-label={`Ask again: ${item.question}`}>Ask again<ChevronRight size={13}/></button></div></li>)}</ul>:<div className="bo-empty">{data?<><strong>No questions to review</strong><span>New unanswered questions will appear here.</span></>:'Loading recent questions…'}</div>}
      <details className="bo-tracking-note"><summary>Last 30 days · Admin chats only</summary><p>Showing up to 10 recent questions from web-admin chats. Service errors are excluded. Up to 200 entries are stored locally for 30 days. Avoid entering personal details.</p></details>
    </div></section>
  </aside>
}
