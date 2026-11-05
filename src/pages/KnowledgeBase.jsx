import { memo, useEffect, useMemo, useState } from 'react'
import { UploadCloud, FileText, Search, ChevronRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { chunkParagraphs } from '../lib/chunkDisplay'
import { documentCache } from '../lib/documentStore'
import { invalidateOverview } from '../lib/overviewCache'
import DocumentUploadDialog from '../components/DocumentUploadDialog'
import { documentRequest } from '../lib/documentAdmin'
import FilterPopup from '../components/FilterPopup'
import Modal from '../components/Modal'
import DocumentDetailModal from '../components/DocumentDetailModal'
import { can } from '../config/permissions'
import './DocumentManagement.css'

const categoryLabel=value=>({'Executive Order / Administrative Policy':'Executive order / Policy','Lokal na Ordinansa':'Local ordinance','Barangay Resolution':'Barangay resolution','Citizens Charter / Clearance Requirements':"Citizen’s Charter / Requirements"}[value]||value)
const DocumentRow=memo(function DocumentRow({doc,onSelect}) {
  const type=doc.filename.toLowerCase().endsWith('.pdf')?'PDF':'TXT'
  const title=(doc.title||doc.filename).replace(/\.(pdf|txt)$/i,'').replace(/_/g,' ')
  return <button type="button" className="dm-document-row" onClick={()=>onSelect(doc)} aria-label={`View ${title}`}>
    <span className="dm-file-icon"><FileText size={20}/><small>{type}</small></span>
    <span className="dm-file-info"><strong>{title}</strong><span className="dm-row-metadata">{doc.category&&<span>{categoryLabel(doc.category)}</span>}<span>{doc.pages.length?`${doc.pages.length} pages`:'Text document'}</span>{doc.reference&&<span>{doc.reference}</span>}</span>{doc.summary&&<span className="dm-document-summary">{doc.summary}</span>}</span>
    <span className="dm-chunk-count"><strong>{doc.chunks}</strong><span className="dm-mobile-chunk-label">chunks</span></span>
    <span className={`dm-status ${doc.activeChunks?'is-active':''}`}>{doc.activeChunks===doc.chunks?'Active':doc.activeChunks?'Partly active':'Inactive'}</span><ChevronRight size={18}/>
  </button>
})

export default function KnowledgeBase() {
  const { user } = useAuth()
  const { documents: approvalDocuments, updateDocument, addAuditEntry } = useData()
  const { showToast } = useToast()
  const [documents, setDocuments] = useState(() => documentCache.library() || [])
  const [loading, setLoading] = useState(() => documentCache.library() === null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [format, setFormat] = useState('all')
  const [status, setStatus] = useState('all')
  const [docCategory,setDocCategory] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [chunks, setChunks] = useState([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [approvalSelected, setApprovalSelected] = useState(null)
  const canIndex = can(user?.role, 'knowledgeBase', 'create') || can(user?.role, 'knowledgeBase', 'update')
  const canApprove = can(user?.role, 'knowledgeBase', 'approve')
  const pendingApprovals = (approvalDocuments || []).filter(doc => doc.officialStatus !== 'Opisyal' && doc.status !== 'Retired')

  async function approveOfficialDocument(doc) {
    const result = await updateDocument(doc.id, { officialStatus: 'Opisyal' })
    if (!result?.success) return showToast(result?.error || 'Hindi naaprubahan ang dokumento.', 'error')
    addAuditEntry(`Inaprubahan bilang opisyal ang knowledge-base document: ${doc.title}`, { color: 'green', eventType: 'approve', targetTable: 'documents', targetId: doc.id, before: { approval_status: doc.officialStatus }, after: { approval_status: 'Opisyal' } })
    setApprovalSelected(null)
    showToast(`${doc.title} ay opisyal nang naaprubahan.`, 'success')
  }

  async function refresh({ clearSources = false } = {}) {
    setError('')
    if(clearSources)documentCache.clearSources()
    try { const cached=documentCache.library(); const rows = await documentCache.loadLibrary({force:true}); setDocuments(previous => JSON.stringify(previous) === JSON.stringify(rows) ? previous : rows); if(rows!==cached)invalidateOverview() }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let mounted=true
    documentCache.loadLibrary().then(rows=>{if(mounted)setDocuments(rows)}).catch(failure=>{if(mounted)setError(failure.message)}).finally(()=>{if(mounted)setLoading(false)})
    return()=>{mounted=false}
  }, [])
  const selectedFilename = selected?.filename
  useEffect(() => {
    let cancelled = false
    if (!selectedFilename) return
    const cached=documentCache.source(selectedFilename)
    setChunks(cached || []); setSourceError(''); setSourceLoading(!cached)
    if(cached)return
    documentCache.loadSource(selectedFilename).then(rows=>{if(!cancelled)setChunks(rows)}).catch(failure=>{if(!cancelled)setSourceError(failure.message)}).finally(()=>{if(!cancelled)setSourceLoading(false)})
    return()=>{cancelled=true}
  }, [selectedFilename])
  async function toggleSource() {
    if (!selected || statusBusy) return
    const active = selected.activeChunks === 0
    setStatusBusy(true); setSourceError('')
    try {
      await documentRequest('/active', { filename: selected.filename, active })
      await refresh()
      documentCache.setSourceActive(selected.filename, active)
      setChunks(previous=>previous.map(chunk=>({...chunk,metadata:{...chunk.metadata,active}})))
      setSelected({ ...selected, activeChunks: active ? selected.chunks : 0 })
      addAuditEntry(`${active ? 'Activated' : 'Archived'} chatbot source: ${selected.filename}`, { color: active ? 'green' : 'orange', eventType: active ? 'activate' : 'archive', targetTable: 'documents', targetKey: selected.filename, before: { active: !active, active_chunks: active ? 0 : selected.chunks }, after: { active, active_chunks: active ? selected.chunks : 0 } })
    } catch (failure) { setSourceError(failure.message); await refresh() }
    finally { setStatusBusy(false) }
  }
  const filtered = useMemo(()=>documents.filter(doc => [doc.filename,doc.title,doc.category,doc.reference,doc.summary].some(value=>String(value||'').toLowerCase().includes(query.toLowerCase())) && (docCategory==='all'||(doc.category||'Uncategorized')===docCategory) && (format === 'all' || doc.filename.toLowerCase().endsWith('.' + format)) && (status === 'all' || (status === 'active' ? doc.activeChunks > 0 : doc.activeChunks === 0))),[documents,query,docCategory,format,status])
  const activeCount = documents.filter(doc => doc.activeChunks > 0).length
  return <div className="document-manager">
    <div className="dm-page-heading"><div><h2>Documents <span>{documents.length}</span></h2></div><div className="dm-toolbar"><label className="dm-search"><Search size={17} /><input aria-label="Search documents by title, filename, or reference" placeholder="Search title, filename, or reference" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="dm-toolbar-actions"><FilterPopup activeCount={[format!=='all',status!=='all',docCategory!=='all'].filter(Boolean).length} title="Filter chatbot documents" count={filtered.length} resultNoun="documents" onReset={() => { setFormat('all'); setStatus('all');setDocCategory('all') }}><label><span>Document category</span><select value={docCategory} onChange={event=>setDocCategory(event.target.value)}><option value="all">All categories</option>{[...new Set(documents.map(doc=>doc.category||'Uncategorized'))].sort().map(value=><option key={value}>{value}</option>)}</select></label><label><span>File type</span><select value={format} onChange={event => setFormat(event.target.value)}><option value="all">All files</option><option value="pdf">PDF</option><option value="txt">TXT</option></select></label><label><span>Retrieval status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All documents</option><option value="active">Active chunks</option><option value="inactive">Inactive only</option></select></label></FilterPopup></div></div>{canIndex && <button className="dm-primary" type="button" onClick={() => setUploadOpen(true)}><UploadCloud size={17} /> Add document</button>}</div>

    {error && <div className="dm-error" role="alert"><strong>Could not load documents</strong><p>{error}</p><button type="button" className="dm-secondary" onClick={()=>refresh({clearSources:true})}>Try again</button></div>}

    {canApprove && <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Official approval authority</p><h3 className="mt-1 text-sm font-bold text-slate-900">Knowledge-base approval queue</h3><p className="mt-1 text-xs text-slate-600">Review indexed documents before making them official.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm">{pendingApprovals.length} pending</span></div>
      {pendingApprovals.length > 0 ? <div className="mt-3 grid gap-2">{pendingApprovals.map(doc => <button type="button" key={doc.id} onClick={() => setApprovalSelected(doc)} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-left hover:border-emerald-300"><span className="min-w-0"><strong className="block truncate text-xs text-slate-800">{doc.title}</strong><small className="text-[10px] text-slate-500">{doc.category} · {doc.dateUploaded}</small></span><span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700"><ShieldCheck size={14} /> Review</span></button>)}</div> : <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">Walang dokumentong naghihintay ng pag-apruba.</p>}
    </section>}

    <div className="dm-library"><header><div className="dm-status-tabs" role="group" aria-label="Document status">{[['all','All documents',documents.length],['active','Active',activeCount],['inactive','Inactive',documents.length-activeCount]].map(([value,label,count])=><button type="button" key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{label}<span>{count}</span></button>)}</div><span className="dm-showing" role="status">{filtered.length===documents.length?'':`${filtered.length} matching`}</span></header>
      {loading ? <p className="dm-empty" role="status">Loading indexed sources…</p> : !filtered.length ? <div className="dm-empty"><FileText size={28} /><h3>{error ? 'Unable to load the library' : documents.length ? 'No matching documents' : 'No indexed documents yet'}</h3><p>{documents.length ? 'Try another filename or clear your filters.' : 'Add a searchable PDF or UTF-8 TXT file to begin.'}</p></div> : <div className="dm-document-list"><div className="dm-list-heading" aria-hidden="true"><span>Document</span><span>Chunks</span><span>Status</span><span /></div>{filtered.map(doc=><DocumentRow key={doc.filename} doc={doc} onSelect={setSelected}/>)}</div>}

    </div>
    {uploadOpen&&<DocumentUploadDialog open onClose={()=>setUploadOpen(false)} onIndexed={async result=>{if(result){setUploadOpen(false);showToast(`${result.filename} added successfully. Ready for Barangay Bot.`, 'success');addAuditEntry(`Indexed chatbot document: ${result.filename} (${result.chunks} chunks)`,{color:'green',eventType:'index',targetTable:'documents',targetKey:result.filename,after:{indexed:true,chunk_count:result.chunks}})}await refresh()}} />}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || selected?.filename || 'Source preview'} maxWidth="max-w-3xl"><div className="dm-source"><div className="dm-source-metadata"><span>Source: {selected?.filename}</span>{selected?.category&&<span>{selected.category}</span>}{selected?.reference&&<span>Reference: {selected.reference}</span>}{selected?.summary&&<p>{selected.summary}</p>}</div>{canIndex && <div className="dm-source-actions"><span>{selected?.activeChunks ? 'Active chunks are available to chatbot lookup.' : 'This source is excluded from chatbot lookup.'}</span><button className="dm-secondary" type="button" disabled={statusBusy} onClick={toggleSource}>{statusBusy ? 'Saving…' : selected?.activeChunks ? 'Archive source' : 'Activate source'}</button></div>}{sourceLoading && <p role="status">Loading source chunks…</p>}{sourceError && <p className="dm-error" role="alert">{sourceError}</p>}{chunks.map((chunk,index) => <details key={chunk.id} open={index === 0}><summary><strong>Chunk {index + 1}</strong><span>{chunk.metadata?.page ? `Page ${chunk.metadata.page}` : 'Text file'} · {chunk.metadata?.active === false ? 'Inactive' : 'Active'}</span></summary><div className="dm-chunk-text">{chunkParagraphs(chunk.content).map((paragraph,index) => <p key={index}>{paragraph}</p>)}</div></details>)}</div></Modal>
    <DocumentDetailModal open={Boolean(approvalSelected)} onClose={() => setApprovalSelected(null)} doc={approvalSelected} onApprove={approveOfficialDocument} onRetire={() => {}} onDelete={() => {}} canApprove={canApprove} canDelete={false} />
  </div>
}
