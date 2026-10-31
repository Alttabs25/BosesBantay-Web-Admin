import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import KnowledgeBase from './KnowledgeBase'
import BarangayChat from './BarangayChat'
import './BotWorkspace.css'

export default function BotWorkspace() {
  const [params,setParams] = useSearchParams()
  const view = ['chat','configuration'].includes(params.get('view')) ? 'chat' : 'documents'
  const [visited,setVisited] = useState(() => new Set([view]))
  function select(next) {
    setVisited(previous => new Set([...previous,next]))
    setParams(next === 'documents' ? {} : { view: 'chat' })
  }
  return <div className="bot-workspace">
    <div className="bot-workspace-toolbar"><div role="tablist" aria-label="Barangay Bot workspace">{[['documents','Documents'],['chat','Chat']].map(([key,label]) => <button type="button" key={key} id={`bot-tab-${key}`} role="tab" aria-selected={view===key} aria-controls={`bot-panel-${key}`} tabIndex={view===key?0:-1} onClick={()=>select(key)} onKeyDown={event=>{
      if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const next=event.key==='Home'?'documents':event.key==='End'?'chat':view==='documents'?'chat':'documents';select(next);document.getElementById(`bot-tab-${next}`)?.focus() }
    }}>{label}</button>)}</div></div>
    <div id="bot-panel-documents" role="tabpanel" aria-labelledby="bot-tab-documents" hidden={view!=='documents'}>{(visited.has('documents')||view==='documents')&&<KnowledgeBase />}</div>
    <div id="bot-panel-chat" role="tabpanel" aria-labelledby="bot-tab-chat" hidden={view!=='chat'}>{(visited.has('chat')||view==='chat')&&<BarangayChat active={view==='chat'} />}</div>
  </div>
}
