import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { documentRequest } from '../lib/documentAdmin'
import { chunkParagraphs } from '../lib/chunkDisplay'
import './ChatbotSettings.css'

export default function ChatbotSettings({ active = true }) {
  const [settings,setSettings]=useState(null)
  const [saved,setSaved]=useState(null)
  const [defaults,setDefaults]=useState(null)
  const [configuration,setConfiguration]=useState({})
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [saving,setSaving]=useState(false)
  const [testing,setTesting]=useState(false)
  const [question,setQuestion]=useState('')
  const [session,setSession]=useState(()=>crypto.randomUUID())
  const [turns,setTurns]=useState([])
  const gridRef=useRef(null)
  const messagesRef=useRef(null)
  const dirty=settings&&JSON.stringify(settings)!==JSON.stringify(saved)
  const presets=[['focused','Focused',3,.45],['balanced','Balanced',5,.3],['broader','Broader',8,.25]]
  const searchPreset=presets.find(([, ,count,threshold])=>settings?.top_k===count&&settings?.threshold===threshold)?.[0] || 'custom'
  const valid=settings&&settings.top_k>=3&&settings.top_k<=8&&settings.threshold>=.2&&settings.threshold<=.7

  async function load(){
    setError('')
    try{const result=await documentRequest('/chatbot/settings');setSettings(result.settings);setSaved(result.settings);setDefaults(result.defaults);setConfiguration(result)}
    catch(failure){setError(failure.message)}
  }
  useEffect(()=>{load()},[])
  useLayoutEffect(()=>{
    const grid=gridRef.current
    if(!grid||!active)return
    const resize=()=>grid.style.setProperty('--bot-workspace-height',`${Math.max(540,window.innerHeight-grid.getBoundingClientRect().top-20)}px`)
    resize();window.addEventListener('resize',resize)
    return()=>window.removeEventListener('resize',resize)
  },[Boolean(settings),active,Boolean(error)])
  useEffect(()=>{const box=messagesRef.current;if(box)box.scrollTo({top:box.scrollHeight,behavior:'smooth'})},[turns])
  function change(key,value){setSettings(previous=>({...previous,[key]:value}));setNotice('')}
  async function save(){
    if(!valid||!dirty)return
    setSaving(true);setError('');setNotice('')
    try{const result=await documentRequest('/chatbot/settings',{settings});setSettings(result.settings);setSaved(result.settings);setNotice('Saved. The app will use these settings for its next generated reply.')}
    catch(failure){setError(failure.message)}
    finally{setSaving(false)}
  }
  async function send(event){
    event.preventDefault()
    if(!question.trim()||testing||!valid)return
    const text=question.trim(), snapshot={...settings}
    setQuestion('');setTesting(true)
    setTurns(previous=>[...previous,{question:text,pending:true,settings:snapshot}])
    try{const result=await documentRequest('/chatbot/test',{question:text,session_id:session,settings:snapshot});setTurns(previous=>[...previous.slice(0,-1),{question:text,...result,settings:snapshot}])}
    catch(failure){setTurns(previous=>[...previous.slice(0,-1),{question:text,answer:failure.message,status:'service_failure',settings:snapshot}])}
    finally{setTesting(false)}
  }
  return <div className="bot-settings-page bot-simple-config">
    <div className="bot-settings-toolbar"><div><h2>Chatbot settings</h2><p>Change settings, try a question, then save when satisfied.</p></div>{settings&&<span className="bot-draft-state" data-dirty={Boolean(dirty)}>{dirty?'Not saved to app':'Matches app settings'}</span>}</div>
    {error&&<div className="bot-settings-error" role="alert">{error}{!settings&&<button type="button" onClick={load}>Retry</button>}</div>}
    {!settings?!error&&<p role="status">Loading current app settings…</p>:<>
      <div className="bot-current-strip"><span>Current model <strong>{configuration.model}</strong></span><span>Embeddings <strong>{configuration.embedding_model}</strong></span><span>Sources <strong>{configuration.setup?.table || 'rag_documents'}</strong></span></div>
      <div ref={gridRef} className="bot-settings-grid">
        <section className="bot-preferences"><header><div><h3><span className="bot-step">1</span>Adjust settings</h3><p>These start with the app’s saved values.</p></div></header>
          <div className="bot-preference-body">
            <label className="bot-simple-field"><span>Tone</span><select value={settings.tone} onChange={event=>change('tone',event.target.value)}><option value="friendly">Friendly and conversational</option><option value="professional">Professional and direct</option></select></label>
            <fieldset><legend>Answer length</legend><div className="bot-options compact">{[['brief','Short'],['standard','Standard'],['detailed','Detailed']].map(([value,label])=><label key={value}><input type="radio" name="bot-length" checked={settings.length===value} onChange={()=>change('length',value)}/><span>{label}</span></label>)}</div></fieldset>
            <label className="bot-toggle"><span><strong>Suggest related questions</strong><small>Only when supported by the documents.</small></span><input type="checkbox" checked={settings.related_topics} onChange={event=>change('related_topics',event.target.checked)}/></label>
            <label className="bot-simple-field"><span>Search approach</span><select value={searchPreset} onChange={event=>{const preset=presets.find(([key])=>key===event.target.value);if(preset)setSettings(previous=>({...previous,top_k:preset[2],threshold:preset[3]}));setNotice('')}}><option value="focused">Focused · fewer, stricter matches</option><option value="balanced">Balanced · recommended</option><option value="broader">Broader · more supporting passages</option>{searchPreset==='custom'&&<option value="custom">Custom settings</option>}</select><small>Use Balanced unless your test questions need a different approach.</small></label>
            <details className="bot-advanced"><summary>Advanced search values</summary><label><span>Maximum passages</span><select value={settings.top_k} onChange={event=>change('top_k',Number(event.target.value))}>{[3,4,5,6,7,8].map(value=><option key={value}>{value}</option>)}</select></label><label><span>Relevance cutoff</span><input type="number" min="0.2" max="0.7" step="0.05" value={settings.threshold} onChange={event=>change('threshold',Number(event.target.value))}/><small>Higher is stricter. This is not an accuracy percentage.</small></label><button type="button" className="bot-reset-defaults" onClick={()=>{setSettings({...defaults});setNotice('Defaults loaded for preview. Save to apply them.')}}>Restore default settings</button></details>
            <p className="bot-protected-note">Always on: barangay scope, document grounding, citations, and language matching.</p>
            {notice&&<p className="bot-settings-success" role="status">{notice}</p>}
          </div>
          <footer>{dirty?<button className="bot-secondary" type="button" disabled={saving} onClick={()=>{setSettings({...saved});setNotice('')}}>Undo changes</button>:<span className="bot-save-hint">No unsaved changes</span>}<button className="bot-primary" type="button" disabled={!dirty||saving||!valid} onClick={save}>{saving?'Saving…':'3. Save to app'}</button></footer>
        </section>
        <section className="bot-test-panel"><header><div><h3><span className="bot-step">2</span>Try a question</h3><p>Uses the settings on the left. Testing does not change the app.</p></div><button className="bot-secondary" type="button" disabled={testing} onClick={()=>{setTurns([]);setSession(crypto.randomUUID())}}>New chat</button></header>
          <div className="bot-test-context"><span className="bot-test-mode-dot"/>{dirty?'Previewing unsaved settings':'Testing current app settings'}<span className="bot-test-model">{configuration.model}</span></div>
          <div ref={messagesRef} className="bot-test-messages" aria-live="polite">{!turns.length&&<div className="bot-test-empty"><h4>Ask as a resident would</h4><p>Use English, Tagalog, or Taglish. A specific question shows the response style more clearly than a greeting.</p><div>{[['Barangay service','Magkano ang barangay clearance?'],['Step-by-step','Paano kumuha ng barangay clearance?'],['Missing information','May libreng legal consultation ba bukas?'],['Outside scope','Tell me about movies']].map(([label,text])=><button key={text} type="button" onClick={()=>setQuestion(text)}><small>{label}</small><span>{text}</span></button>)}</div></div>}{turns.map((turn,index)=><article key={index}><div className="bot-test-question"><span className="bot-speaker">You</span>{turn.question}</div><div className={`bot-test-answer ${turn.status==='service_failure'?'has-error':''}`}><span className="bot-speaker">Barangay Bot</span>{turn.pending?<p role="status">Searching documents and preparing a reply…</p>:<><p>{turn.answer}</p><div className="bot-test-metrics"><span>{turn.status==='service_failure'?'Service issue':turn.sources?.length?`${turn.sources.length} sources`:'Menu / fallback'}</span>{turn.elapsed_ms!=null&&<span>{(turn.elapsed_ms/1000).toFixed(1)}s</span>}<span>{turn.settings.tone} · {turn.settings.length}</span></div>{turn.sources?.length>0&&<details><summary>View supporting passages</summary>{turn.sources.map((source,sourceIndex)=><section key={sourceIndex}><strong>{source.filename}{source.page?` · Page ${source.page}`:''}</strong><div className="bot-source-text">{chunkParagraphs(source.excerpt).map((paragraph,part)=><p key={part}>{paragraph}</p>)}</div></section>)}</details>}</>}</div></article>)}</div>
          <form onSubmit={send}><div className="bot-composer"><textarea aria-label="Test chatbot question" value={question} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();send(event)}}} placeholder="Type a barangay question…" rows={2} maxLength={4000} disabled={testing}/><button className="bot-primary" disabled={testing||!question.trim()||!valid}>{testing?'Testing…':'Send'}</button></div><span className="bot-composer-hint">Ctrl + Enter to send · Menus and greetings keep their existing wording.</span></form>
        </section>
      </div>
    </>}
  </div>
}
