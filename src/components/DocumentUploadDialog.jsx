import { useRef, useState } from 'react'
import { UploadCloud, FileText } from 'lucide-react'
import Modal from './Modal'
import { DOCUMENT_CATEGORIES } from '../data/mockDocuments'
import { documentRequest, filePayload } from '../lib/documentAdmin'
import { chunkParagraphs } from '../lib/chunkDisplay'
import './DocumentUploadDialog.css'

export default function DocumentUploadDialog({open,onClose,onIndexed}) {
  const [step,setStep]=useState(1), [mode,setMode]=useState('file')
  const [title,setTitle]=useState(''), [category,setCategory]=useState(DOCUMENT_CATEGORIES[0])
  const [reference,setReference]=useState(''), [summary,setSummary]=useState('')
  const [file,setFile]=useState(null), [text,setText]=useState(''), [preset,setPreset]=useState('balanced')
  const [preview,setPreview]=useState(null), [payload,setPayload]=useState(null)
  const [busy,setBusy]=useState(''), [error,setError]=useState(''), [success,setSuccess]=useState('')
  const picker=useRef(null), generated=useRef(false), automaticTitle=useRef('')
  const working=Boolean(busy)
  const categoryLabel=value=>({'Lokal na Ordinansa':'Ordinance','Barangay Resolution':'Resolution','Executive Order / Administrative Policy':'Executive order / Policy','Citizens Charter / Clearance Requirements':"Citizen’s Charter / Requirements"}[value]||value)
  function invalidate(){setPreview(null);setPayload(null);setError('');setSuccess('');if(generated.current){setSummary('');generated.current=false}}
  async function prepare(next,size=preset,continueToReview=false){
    invalidate();setBusy('preview')
    try{const body={...await filePayload(next),preset:size};const result=await documentRequest('/preview',body);setPayload(body);setPreview(result);if(continueToReview)await review(body)}
    catch(failure){setError(failure.message)}finally{setBusy('')}
  }
  function choose(next){if(!next)return;setFile(next);if(!title.trim()||title===automaticTitle.current){automaticTitle.current=next.name.replace(/\.[^.]+$/,'');setTitle(automaticTitle.current)}prepare(next)}
  function prepareText(){const name=title.trim().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/\s+/g,'_').slice(0,150)||'barangay-document';prepare(new File([text],name+'.txt',{type:'text/plain;charset=utf-8'}),preset,true)}
  async function review(sourcePayload=payload){
    setStep(2);setError('');if(summary.trim())return
    setBusy('summary')
    try{const result=await documentRequest('/summary',sourcePayload);setSummary(result.summary);generated.current=true}
    catch(failure){setError(failure.message)}finally{setBusy('')}
  }
  async function save(){
    if(!preview||!title.trim()||working)return
    setBusy('index');setError('')
    try{
      const result=await documentRequest('/index',{...payload,metadata:{document_title:title.trim(),document_type:category,reference_number:reference.trim(),summary:summary.trim()}})
      setSuccess(`${title.trim()} added. ${result.chunks} chunks indexed.`)
      setStep(1);setPreview(null);setPayload(null);setFile(null);setText('');setTitle('');setReference('');setSummary('');generated.current=false
      await onIndexed(result)
    }catch(failure){setError(failure.message);await onIndexed(null)}finally{setBusy('')}
  }
  return <Modal open={open} onClose={()=>{if(!working)onClose()}} title="Add chatbot document" maxWidth="max-w-4xl">
    <div className="document-upload-form">
      <nav className="du-progress" aria-label="Upload progress"><span aria-current={step===1?'step':undefined}><b>1</b>Document</span><i/><span aria-current={step===2?'step':undefined}><b>2</b>Review & add</span></nav>
      <div className="du-content-frame">
      <div className="document-upload-scroll">
        {step===1?<div className="du-setup-layout">
          <section className="du-block">
            <div className="du-section-heading"><h3>Source document</h3><span>PDF / TXT <b aria-hidden="true">·</b> 20 MB max</span></div>
            <div className="du-source-tabs" role="group" aria-label="Document source">{[['file','Upload file'],['text','Paste text']].map(([value,label])=><button key={value} disabled={working} aria-pressed={mode===value} onClick={()=>{setMode(value);invalidate()}}>{label}</button>)}</div>
            {mode==='file'?<><button className="du-dropzone" disabled={working} onClick={()=>picker.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!working)choose(e.dataTransfer.files?.[0])}}>{file?<FileText size={28}/>:<UploadCloud size={28}/>}<strong>{file?.name||'Drop your document here'}</strong><span>{file?'Click to change file':'or click to browse files'}</span></button><input hidden ref={picker} type="file" accept=".pdf,.txt" onChange={e=>{choose(e.target.files?.[0]);e.target.value=''}}/></>:<div className="du-paste"><textarea aria-label="Document text" value={text} disabled={working} rows={5} maxLength={2000000} onChange={e=>{setText(e.target.value);invalidate()}} placeholder="Paste the document text…"/></div>}
            <div className="du-file-status" role="status">{busy==='preview'?'Reading document…':preview?`Text ready · ${preview.chunks} chunks${preview.pages.length?` · ${preview.pages.length} pages`:''}`:'Scanned PDFs need OCR before upload.'}</div>
          </section>
          <section className="du-block"><div className="du-section-heading"><h3>Document details</h3></div>
            <div className="du-identity-fields">
              <label className="du-field"><span>Document title <small>Required</small></span><input value={title} disabled={working} maxLength={180} onChange={e=>{setTitle(e.target.value);if(mode==='text')invalidate()}} placeholder="e.g. Barangay Clearance Requirements"/></label>
              <label className="du-field"><span>Reference no. <small>Optional</small></span><input value={reference} disabled={working} maxLength={120} onChange={e=>setReference(e.target.value)} placeholder="e.g. Ord. 2026-003"/></label>
            </div>
            <fieldset className="du-category-choices" disabled={working}><legend>Category</legend><div>{DOCUMENT_CATEGORIES.map(value=><label key={value}><input type="radio" name="document-category" value={value} checked={category===value} onChange={()=>setCategory(value)}/><span><i aria-hidden="true"/>{categoryLabel(value)}</span></label>)}</div></fieldset>
            <fieldset className="du-preset-choices" disabled={working}><legend>Passage size <small>Balanced is recommended</small></legend><div>{[['precise','Precise','900'],['balanced','Balanced','1,500'],['context','More context','2,400']].map(([value,label,size])=><label key={value}><input type="radio" name="document-passage-size" value={value} checked={preset===value} onChange={()=>{setPreset(value);invalidate();if(mode==='file'&&file)prepare(file,value)}}/><span>{label}<small>{size} characters</small></span></label>)}</div></fieldset>
          </section>

        </div>:<div className="du-review-layout">
          <div className="du-review-title"><FileText size={22}/><div><h3>{title}</h3><p>{categoryLabel(category)}</p><dl className="du-source-facts"><div><dt>Source</dt><dd>{preview?.filename}</dd></div>{reference&&<div><dt>Reference</dt><dd>{reference}</dd></div>}</dl></div></div>
          <section className="du-block du-summary-section"><label className="du-field"><span>Document summary <small>{generated.current?'AI draft':'Editable'}</small></span><textarea rows={3} value={summary} disabled={working} maxLength={1000} onChange={e=>{generated.current=false;setSummary(e.target.value)}} placeholder={busy==='summary'?'Writing a short summary…':'Add a short summary, or leave it blank.'}/></label><div className="du-summary-toolbar"><span role="status">{busy==='summary'?'Generating from document text…':generated.current?'AI draft · Review before adding.':'Optional · Helps staff identify this document.'}</span><button disabled={working||Boolean(summary.trim())} onClick={()=>review()}>Generate summary</button></div></section>
          <section className="du-block"><div className="du-section-heading"><h3>Text preview</h3><span>{preview?.chunks} chunks{preview?.pages.length?` · ${preview.pages.length} pages`:''}</span></div><div className="du-ready-preview"><section>{chunkParagraphs(preview?.excerpt||'').map((paragraph,index)=><p key={index}>{paragraph}</p>)}</section><small>Preview excerpt · Original PDF page references are preserved.</small></div></section>
        </div>}
        {error&&<div className="du-error" role="alert"><strong>{step===2&&!summary.trim()&&busy!=='index'?'Check the summary':'Unable to continue'}</strong><p>{error}</p>{step===2&&!summary.trim()&&<span>You can retry above, write your own summary, or add without one.</span>}</div>}{success&&<p className="dm-success" role="status">{success}</p>}
      </div>
      </div>
      <footer><span role="status">{busy==='index'?'Indexing… Keep this window open.':step===1?'Review before adding to Barangay Bot':'The chatbot uses the indexed document text.'}</span><div><button className="dm-secondary" disabled={working} onClick={()=>step===2?setStep(1):onClose()}>{step===2?'Back':'Cancel'}</button>{step===1&&mode==='text'&&!preview?<button className="dm-primary" disabled={working||!text.trim()||!title.trim()} onClick={prepareText}>{busy==='preview'?'Preparing…':'Review document'}</button>:<button className="dm-primary" disabled={!preview||!title.trim()||working} onClick={step===1?()=>review():save}>{busy==='index'?'Adding…':busy==='summary'?'Generating summary…':step===1?'Review document':'Add document'}</button>}</div></footer>
    </div>
  </Modal>
}
