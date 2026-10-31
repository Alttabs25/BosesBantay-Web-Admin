import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FileText, RefreshCw, Copy, Check, Play, Square } from 'lucide-react'
import { documentRequest } from '../lib/documentAdmin'
import ConfirmDialog from './ConfirmDialog'
import Modal from './Modal'
import './ServiceComplaintRegistry.css'
import './ServiceControls.css'

let lastStatus=null, statusRequest=null
function fetchStatus(){
  if(!statusRequest)statusRequest=documentRequest('/services').then(result=>{lastStatus=result;return result}).finally(()=>{statusRequest=null})
  return statusRequest
}
const SERVICE_DETAILS={
  ollama:{description:'Runs the local chat model and document embeddings.',impact:'Chat replies and document embeddings will be unavailable until Ollama is restarted.'},
  whisper:{description:'Converts recorded audio into text for the mobile app.',impact:'New voice recordings cannot be transcribed until Whisper is restarted.'},
  api:{description:'Connects the mobile app to chat and transcription services.',impact:'Mobile chat and voice requests will be unavailable until the gateway is restarted.'},
}
export default function ServiceControls(){
  const [status,setStatus]=useState(lastStatus),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [checkedAt,setCheckedAt]=useState(null),[copied,setCopied]=useState(false)
  const [action,setAction]=useState(''),[stopTarget,setStopTarget]=useState(null)
  const [bulkVerb,setBulkVerb]=useState('')
  const [confirmStartAll,setConfirmStartAll]=useState(false)
  const [logTarget,setLogTarget]=useState(null),[logs,setLogs]=useState(''),[logError,setLogError]=useState(''),[logBusy,setLogBusy]=useState(false)
  const workspace=useRef(null)
  const polling=useRef(false),mounted=useRef(true),logVersion=useRef(0)
  useLayoutEffect(()=>{
    const element=workspace.current
    if(!element)return
    let frame=0
    const measure=()=>{
      cancelAnimationFrame(frame)
      frame=requestAnimationFrame(()=>{
        const available=Math.max(300,(window.visualViewport?.height||window.innerHeight)-element.getBoundingClientRect().top-16)
        element.style.setProperty('--services-available-height',`${Math.floor(available)}px`)
      })
    }
    measure()
    const observer=new ResizeObserver(measure)
    if(element.parentElement)observer.observe(element.parentElement)
    window.addEventListener('resize',measure)
    window.visualViewport?.addEventListener('resize',measure)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure)}
  },[])
  async function refresh(){
    if(polling.current)return
    polling.current=true
    try{const result=await fetchStatus();if(mounted.current){setStatus(previous=>JSON.stringify(previous)===JSON.stringify(result)?previous:result);setError('');setCheckedAt(new Date())}}
    catch(failure){if(mounted.current)setError(failure.message)}finally{polling.current=false}
  }
  useEffect(()=>{mounted.current=true;refresh();const timer=setInterval(()=>{if(!document.hidden)refresh()},15000);return()=>{mounted.current=false;clearInterval(timer);logVersion.current++}},[])
  async function control(service,verb){
    setStopTarget(null);setAction(service);setBulkVerb(service==='all'?verb:'');setError('');setNotice('')
    try{const result=await documentRequest('/services/action',{service,action:verb});await refresh();if(mounted.current){setNotice(result.message);if(result.ok===false)setError(result.results.filter(item=>!item.ok).map(item=>item.message).join(' '))}}
    catch(failure){if(mounted.current)setError(failure.message)}finally{if(mounted.current)setAction('')}
  }
  async function showLogs(service){
    const version=++logVersion.current;setLogTarget(service);setCopied(false);setLogs('');setLogError('');setLogBusy(true)
    try{const result=await documentRequest('/services/logs',{service:service.id});if(mounted.current&&version===logVersion.current)setLogs(result.text)}
    catch(failure){if(mounted.current&&version===logVersion.current)setLogError(failure.message)}finally{if(mounted.current&&version===logVersion.current)setLogBusy(false)}
  }
  const services=(status?.services||[]).filter(service=>SERVICE_DETAILS[service.id])
  const ingestion=status?.ingestion
  const gateway=services.find(service=>service.id==='api')
  const whisper=services.find(service=>service.id==='whisper')
  const ollama=services.find(service=>service.id==='ollama')
  const missing=ollama?.ready?(status.required_models||[]).filter(model=>!ollama.models.some(installed=>installed===model||installed===model+':latest')):[]
  const healthy=Boolean(status&&!error)
  const aiDependencies=healthy&&ollama?.ready&&missing.length===0
  const features=[
    {label:'Mobile chat',ready:healthy&&gateway?.ready&&aiDependencies,reason:!healthy?'Status unavailable':!gateway?.ready?'Start the gateway.':!ollama?.ready?'Start Ollama.':missing.length?'Install the missing models.':'Local dependencies connected.'},
    {label:'Transcription',ready:healthy&&gateway?.ready&&whisper?.ready,reason:!healthy?'Status unavailable':!whisper?.ready?'Start Whisper.':!gateway?.ready?'Start the gateway.':'Local dependencies connected.'},
    {label:'Document indexing',ready:healthy&&aiDependencies&&ingestion?.enabled,reason:!healthy?'Status unavailable':!ingestion?.enabled?'Enable document ingestion.':!ollama?.ready?'Start Ollama.':missing.length?'Install the missing models.':'Local dependencies connected.'},
  ]
  const attention=services.filter(service=>!service.ready)
  async function copyLogs(){try{await navigator.clipboard.writeText(logs);setCopied(true)}catch{setLogError('Could not copy logs. Select the text and copy it manually.')}}
  return <section className="local-services" aria-label="Local service controls">

    {error&&<p className="service-panel-error" role="alert">{error}</p>}
    {notice&&<p className="service-panel-notice" role="status">{notice}</p>}
    {!status&&!error&&<p className="service-panel-loading" role="status">Checking services…</p>}
    <div className="services-workspace" ref={workspace}><div className="services-main">
    <section className="services-container">
    <header className="services-compact-header"><div className="services-header-identity"><div className="services-header-title"><h3>Service controls</h3><span className="services-online-count">{status?`${services.filter(service=>service.ready).length} / ${services.length} online`:'Checking…'}</span></div><span className="services-last-check">{checkedAt?`Checked ${checkedAt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:'Auto-updates every 15s'}</span></div><div className="services-header-tools"><button type="button" onClick={refresh} disabled={Boolean(action)}><RefreshCw size={14}/>Check status</button><div className="services-bulk-actions" role="group" aria-label="Quick service actions"><button type="button" className="services-start-all" disabled={!status||Boolean(action)||(services.every(service=>service.ready)&&ingestion?.enabled)} onClick={()=>setConfirmStartAll(true)}><Play size={14} aria-hidden="true"/>{action==='all'&&bulkVerb==='start'?'Starting all…':'Start all'}</button><button type="button" className="services-stop-all" disabled={!status||Boolean(action)||(!services.some(service=>service.can_stop)&&!ingestion?.enabled)} onClick={()=>setStopTarget({id:'all',title:'all services'})}><Square size={13} aria-hidden="true"/>{action==='all'&&bulkVerb==='stop'?'Stopping all…':'Stop all'}</button></div></div></header>
    {status&&<div className="service-registry">{services.map(service=>{
      const details=SERVICE_DETAILS[service.id]
      return <article className="service-row" key={service.id}>
        <header className="service-tile-header"><div className="service-row-info"><h4>{service.title}</h4></div>
        <span className={`service-state ${service.ready?'is-ready':''}`}><i/>{service.ready?'Running':service.can_start?'Stopped':service.state}</span></header>
        <div className="service-brief"><p>{details.description}</p></div>

        <details className="service-row-details"><summary>Setup & troubleshooting</summary><div><dl className="service-detail-facts"><div><dt>Local port</dt><dd>{service.port}</dd></div><div><dt>Process control</dt><dd>{service.managed?'Managed by this project':service.ready?'External process':'No managed process detected'}</dd></div></dl>{!service.ready&&<p>{service.can_start?'Start this service to restore its features.':service.can_stop?'The process is running but not responding yet. Check logs if this persists.':'This process is not controlled here. Check the port and logs.'}</p>}{service.id==='ollama'&&<ul>{(status.required_models||[]).map(model=><li key={model}><code>{model}</code><span>{!service.ready?'Not checked':service.models.some(installed=>installed===model||installed===model+':latest')?'Installed':'Missing'}</span></li>)}</ul>}{service.id==='api'&&<p>Chat requires Ollama. Voice transcription requires Whisper.</p>}</div></details>
        <div className="service-row-actions"><button type="button" className="service-logs" onClick={()=>showLogs(service)}><FileText size={14}/>View logs</button><button type="button" className={service.can_stop?'service-stop':'service-start'} disabled={Boolean(action)||(!service.can_stop&&!service.can_start)} onClick={()=>service.can_stop?setStopTarget(service):control(service.id,'start')}>{action===service.id?'Updating…':service.can_stop?'Stop service':service.ready?'Managed externally':'Start service'}</button></div>
      </article>
    })}{ingestion&&<article className="service-row">
      <header className="service-tile-header"><div className="service-row-info"><h4>Document ingestion</h4></div>
      <span className={`service-state ${ingestion.enabled?'is-ready':''}`}><i/>{ingestion.state}</span></header><div className="service-brief"><p>Uploads and indexes documents for Barangay Bot.</p></div>

      <details className="service-row-details"><summary>Setup & troubleshooting</summary><div><p>Pausing stops new uploads. Existing documents remain searchable.</p><p>Ollama embeddings: {!healthy?'not checked':aiDependencies?'available':'unavailable'}. A working Supabase connection is also required.</p></div></details>
        <div className="service-row-actions"><button type="button" className={ingestion.enabled?'service-stop':'service-start'} disabled={Boolean(action)||ingestion.busy} onClick={()=>control('ingestion',ingestion.enabled?'stop':'start')}>{action==='ingestion'?'Updating…':ingestion.enabled?'Pause ingestion':'Enable ingestion'}</button></div>
    </article>}</div>}
    {missing.length>0&&<p className="service-model-warning">Missing models: {missing.join(', ')}. Install them in Ollama to enable chat and indexing.</p>}
    <footer className="service-local-note"><strong>Local setup</strong><p>Keep this computer on. Remote access and Supabase connectivity are checked separately.</p></footer>
    </section>
    </div><aside className="services-sidebar service-summary-panel" aria-label="Service readiness overview">
      <div className="service-summary-heading"><h2>Service overview</h2></div>
      <div className="service-summary-body">
        <div className="service-summary-total"><span>Services online</span><strong>{status?services.filter(service=>service.ready).length:'—'}<small> / {services.length||'—'}</small></strong></div>
        <section className="service-summary-section"><h3>Feature readiness</h3><div className="service-summary-statuses">{features.map(feature=><div className="service-summary-status services-feature-row" key={feature.label}><div><span className="service-summary-status-name">{feature.label}</span>{status&&!feature.ready&&<p>{feature.reason}</p>}</div><span className={`services-feature-value ${feature.ready?'is-ready':'needs-attention'}`}><i aria-hidden="true"/>{!status?'Checking':feature.ready?'Connected':'Attention'}</span></div>)}</div></section>
        <section className="service-summary-section"><h3>Next steps</h3>{!healthy?<p className="services-sidebar-note">Connect to the control service to check what needs attention.</p>:<>
          {attention.length>0?<ul className="services-next-list">{attention.map(service=><li key={service.id}><div><strong>{service.title}</strong><span>{service.can_start?'Service is stopped.':service.can_stop?'Check startup progress in the logs.':'Check the service process and port.'}</span></div>{service.can_start?<button type="button" disabled={Boolean(action)} onClick={()=>control(service.id,'start')}>{action===service.id?'Starting…':'Start'}</button>:<button type="button" onClick={()=>showLogs(service)}>Logs</button>}</li>)}</ul>:<p className="services-sidebar-note">All local service endpoints are responding.</p>}
          {missing.length>0&&<p className="services-sidebar-warning">Missing models: {missing.join(', ')}.</p>}
          {!ingestion?.enabled&&<button className="services-enable" type="button" disabled={Boolean(action)} onClick={()=>control('ingestion','start')}>Enable document ingestion</button>}
        </>}</section>
      </div>
    </aside></div>
    <ConfirmDialog open={confirmStartAll} onClose={()=>setConfirmStartAll(false)} onConfirm={()=>control('all','start')} title="Start all services?" message="Starts Ollama, Whisper transcription and the chat gateway, then enables document ingestion. Services already running are kept as they are. Expo and this control panel are not changed." confirmLabel="Start all services" cancelLabel="Cancel" danger={false}/>
    <ConfirmDialog open={Boolean(stopTarget)} onClose={()=>setStopTarget(null)} onConfirm={()=>{if(stopTarget)control(stopTarget.id,'stop')}} title={`Stop ${stopTarget?.title||'service'}?`} message={stopTarget?.id==='all'?'Stops the managed chat gateway, Whisper and Ollama, and pauses document ingestion. Chat, transcription and indexing will be unavailable. Expo and this control panel stay running.':SERVICE_DETAILS[stopTarget?.id]?.impact||''} confirmLabel={stopTarget?.id==='all'?'Stop all services':'Stop service'} cancelLabel="Cancel" danger/>
    <Modal open={Boolean(logTarget)} onClose={()=>{logVersion.current++;setLogTarget(null)}} title={`${logTarget?.title||'Service'} logs`} maxWidth="max-w-4xl"><div className="service-log-toolbar"><span>Recent entries · Credentials redacted</span><div className="service-log-actions"><button type="button" disabled={logBusy||!logs} onClick={copyLogs}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?'Copied':'Copy logs'}</button><button type="button" disabled={logBusy} onClick={()=>showLogs(logTarget)}><RefreshCw size={14}/>Reload logs</button></div></div>{logError&&<p className="service-panel-error" role="alert">{logError}</p>}<pre className="service-log-output" aria-live="polite">{logBusy?'Loading logs…':logs}</pre></Modal>
  </section>
}
