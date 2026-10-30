import './AuditLogs.css'
import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Search, ShieldCheck, Users } from 'lucide-react'
import { useData } from '../context/DataContext'

const PAGE_SIZE = 10

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function AuditLogs() {
  const { auditLog } = useData()
  const [query, setQuery] = useState('')
  const [toneFilter, setToneFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return auditLog.filter((log) => {
      const matchesSearch = !search || [log.actorName, log.action, log.actorRole, log.timestamp].some((value) => String(value || '').toLowerCase().includes(search))
      const matchesTone = toneFilter === 'all' || (toneFilter === 'attention' ? ['red', 'orange'].includes(log.color) : log.color === toneFilter)
      return matchesSearch && matchesTone
    })
  }, [auditLog, query, toneFilter])

  useEffect(() => { setCurrentPage(1) }, [query, toneFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(() => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filtered, currentPage])
  const startEntry = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const endEntry = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const attentionCount = auditLog.filter((log) => ['red', 'orange'].includes(log.color)).length
  const successCount = auditLog.filter((log) => log.color === 'green').length
  const actorCount = new Set(auditLog.map((log) => log.actorName).filter(Boolean)).size
  const metrics = [
    { value: 'all', label: 'Lahat ng aktibidad', count: auditLog.length, tone: 'blue', icon: Activity },
    { value: 'attention', label: 'Kailangang suriin', count: attentionCount, tone: 'orange', icon: AlertTriangle },
    { value: 'green', label: 'Matagumpay na aksyon', count: successCount, tone: 'green', icon: CheckCircle2 },
  ]

  function visiblePages() {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index)
  }

  return <div className="audit-page">
    <section className="audit-metric-grid" aria-label="Buod ng audit activity">
      {metrics.map(({ value, label, count, tone, icon: Icon }) => <button type="button" key={value} onClick={() => setToneFilter(value)} aria-pressed={toneFilter === value} className={`audit-metric tone-${tone} ${toneFilter === value ? 'is-active' : ''}`}><div><p>{label}</p><strong>{count}</strong></div><span><Icon size={21} /></span></button>)}
      <div className="audit-metric tone-blue"><div><p>Mga natatanging actor</p><strong>{actorCount}</strong></div><span><Users size={21} /></span></div>
    </section>

    <section className="audit-registry">
      <header className="audit-registry-heading">
        <div className="audit-registry-title"><span><ShieldCheck size={20} /></span><div><p>Read-only compliance trail</p><h2>Activity Registry <small>{filtered.length} / {auditLog.length}</small></h2></div></div>
        <div className="audit-registry-tools">
          <label className="audit-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hanapin ang actor, role, o aksyon..." /></label>
          <select value={toneFilter} onChange={(event) => setToneFilter(event.target.value)} aria-label="I-filter ang audit logs"><option value="all">Lahat ng activity</option><option value="attention">Kailangang suriin</option><option value="green">Matagumpay</option><option value="blue">Regular activity</option><option value="red">Critical activity</option></select>
        </div>
      </header>

      <div className="audit-event-list max-h-[calc(100vh-300px)] overflow-y-auto">
        {!paginated.length && <div className="audit-empty-state"><Search size={28} /><h3>Walang nahanap na audit entry</h3><p>Subukan ang ibang search term o activity filter.</p></div>}
        {paginated.map((log) => <article key={log.id} className={`audit-event-card tone-${log.color || 'blue'}`}>
          <div className="audit-event-actor"><span>{initials(log.actorName)}</span><div><h3>{log.actorName}</h3><p>{log.actorRole}</p></div></div>
          <div className="audit-event-action"><p>Recorded action</p><strong>{log.action}</strong></div>
          <time><Clock size={14} />{log.timestamp}</time>
        </article>)}
      </div>

      {filtered.length > 0 && <footer className="audit-pagination"><p>Ipinapakita ang <strong>{startEntry}–{endEntry}</strong> ng <strong>{filtered.length}</strong> na resulta</p><nav aria-label="Audit log pages"><button type="button" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1} aria-label="Nakaraang page"><ChevronLeft size={17} /></button>{visiblePages().map((page) => <button type="button" key={page} onClick={() => setCurrentPage(page)} aria-current={currentPage === page ? 'page' : undefined} className={currentPage === page ? 'is-current' : ''}>{page}</button>)}<button type="button" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages} aria-label="Susunod na page"><ChevronRight size={17} /></button></nav></footer>}
    </section>
  </div>
}
