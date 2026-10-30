import { blotterProgress } from '../lib/blotterProgress'
import './ServiceComplaintRegistry.css'
import './BlotterOverview.css'
import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'

const isPending = (r) => ['Sinuri', 'Under Review', 'Pending'].includes(r.status)
const isInvestigating = (r) => ['Inimbestigahan', 'Investigating'].includes(r.status)
const isResolved = (r) => ['Nareselba', 'Resolved'].includes(r.status)
const isEscalated = r => blotterProgress(r).outcome === 'CFA recorded'

function nextAction(report) { return blotterProgress(report).next }

function formatHearingDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusBadge(report) {
  const progress = blotterProgress(report)
  if (progress.status === 'closed') return { label: 'Closed', color: '#596b82', bg: '#f2f5f8', border: '#d5dee9' }
  if (progress.status === 'review') return { label: 'Under review', color: '#315f9f', bg: '#eef4fd', border: '#c4d5ee' }
  if (progress.status === 'active') return { label: 'In progress', color: '#906017', bg: '#fff7e9', border: '#ead6b1' }
  return { label: progress.statusLabel, color: '#596b82', bg: '#f2f5f8', border: '#d5dee9' }
}
function titleFor(report) {
  const titles = { theft: 'Theft', noise: 'Noise complaint', threats_harassment: 'Threats or harassment', physical_abuse: 'Physical harm', property_damage: 'Property damage', others: 'Other concern' }
  return titles[report.title] || report.title || 'Blotter report'
}
function submittedDate(report) {
  const date = new Date(report.rawDate || '')
  return Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : report.datetime || 'Not recorded'
}
export default function BlotterOverview({ reports, allReports, selectedStatus, onStatusSelect, onOpen, onClearFilters }) {
  const columnsRef = useRef(null)
  const listRef = useRef(null)
  const [page, setPage] = useState(1)
  const resultsKey = reports.map(report => `${report.sourceTable}:${report.dbId || report.id}`).join('|')
  useEffect(() => { setPage(1); listRef.current?.scrollTo({ top: 0 }) }, [resultsKey, selectedStatus])
  const pageCount = Math.max(1, Math.ceil(reports.length / 10))
  const currentPage = Math.min(page, pageCount)
  const pageReports = reports.slice((currentPage - 1) * 10, currentPage * 10)
  const changePage = next => { setPage(Math.max(1, Math.min(pageCount, next))); listRef.current?.scrollTo({ top: 0 }) }
  useLayoutEffect(() => {
    const resize = () => {
      const element = columnsRef.current
      if (element) element.style.setProperty('--blotter-panel-height', `${Math.max(280, window.innerHeight - element.getBoundingClientRect().top - 12)}px`)
    }
    resize(); window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  })
  const pending = allReports.filter(isPending).length
  const inProgress = allReports.filter(isInvestigating).length
  const scheduled = allReports.filter(r => blotterProgress(r).stageKey === 'scheduled').length
  const escalated = allReports.filter(isEscalated).length
  const closed = allReports.filter(isResolved).length
  const needsSchedule = allReports.filter(r => ['schedule_pending','postponed','missed'].includes(blotterProgress(r).stageKey)).length
  const needsOutcome = allReports.filter(r => blotterProgress(r).stageKey === 'outcome_pending').length
  const summaries = [{ key: 'pending', label: 'Under review', value: pending, tone: 'blue' }, { key: 'active', label: 'In progress', value: inProgress, tone: 'amber' }, { key: 'scheduled', label: 'Hearing scheduled', value: scheduled, tone: 'blue' }, { key: 'closed', label: 'Closed', value: closed, tone: 'slate' }, { key: 'escalated', label: 'CFA recorded', value: escalated, tone: 'violet' }]
  return <div ref={columnsRef} className="blotter-overview-columns blotter-home">
    <section ref={listRef} aria-label="Blotter reports" className="blotter-registry-panel">
      <div className="complaint-registry-heading"><div className="service-list-title"><h2>Blotter reports</h2><span>{reports.length === allReports.length ? reports.length : `${reports.length} / ${allReports.length}`}</span></div></div>
      <div className="service-card-list">
        {pageReports.map(report => {
          const badge = statusBadge(report)
          const progress = blotterProgress(report)
          const location = report.location && !['N/A','Hindi tinukoy'].includes(report.location) ? report.location : 'Location not provided'
          return <button type="button" key={`${report.sourceTable}:${report.dbId || report.id}`} onClick={() => onOpen(report)} className="service-list-card">
            <div className="service-card-header"><div className="service-card-heading"><span className="service-card-ref">Report no. {report.id}</span><h3>{titleFor(report)}</h3></div><span className="service-status-tag" style={{ '--service-accent': badge.color, '--service-tint': badge.bg, '--service-border': badge.border }}>{badge.label}</span></div>
            <div className="service-card-address"><span>Location</span><p>{location}</p></div>
            <div className="blotter-card-progress"><div className="blotter-progress-facts"><div className="blotter-stage-row"><span>Stage</span><p>{progress.stage}</p></div>{progress.outcome ? <div className="blotter-stage-row"><span>Outcome</span><p className={progress.outcome === 'CFA recorded' ? 'text-violet-700' : progress.outcome === 'Settled' ? 'text-emerald-700' : ''}>{progress.outcome}</p></div> : ['review','active'].includes(progress.status) ? <div className="blotter-stage-row blotter-next-fact"><span>Next step</span><p>{nextAction(report)}</p></div> : null}</div>{progress.stageKey === 'scheduled' && <time className="blotter-hearing-line">Hearing: {formatHearingDate(report.hearingDate)}</time>}</div>
            <div className="service-card-footer"><div className="service-card-person"><span>Submitted by</span><p>{report.filedBy || 'Not provided'}</p></div><div className="service-card-date"><span>Date submitted</span><time>{submittedDate(report)}</time></div><div className="service-card-open"><span className="service-card-view">View details <ChevronRight size={18} aria-hidden="true" /></span></div></div>
          </button>
        })}
        {!reports.length && <div className="px-5 py-12 text-center"><h3 className="text-base font-semibold text-slate-800">No matching blotter reports</h3><p className="mt-2 text-sm text-slate-500">Try a different search or filter.</p><button type="button" onClick={onClearFilters} className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-bb-blue">Show all reports</button></div>}
      </div>
      {reports.length > 0 && <nav className="blotter-pagination" aria-label="Blotter list pages"><span>{(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, reports.length)} of {reports.length}</span><div><button type="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Next</button></div></nav>}
    </section>
    <aside className="service-summary-panel" aria-label="Blotter overview">
      <div className="service-summary-heading"><h2>Overview</h2></div>
      <div className="service-summary-body"><button type="button" onClick={() => onStatusSelect('all')} className="service-summary-total"><span>Total reports</span><strong>{allReports.length}</strong></button>
        <section className="service-summary-section"><h3>Status</h3><div className="service-summary-statuses">{summaries.map(item => <button type="button" key={item.key} aria-pressed={selectedStatus === item.key} onClick={() => onStatusSelect(selectedStatus === item.key ? 'all' : item.key)} className={`service-summary-status ${selectedStatus === item.key ? 'is-active' : ''}`}><span className="service-summary-status-name"><span aria-hidden="true" className={`service-summary-dot tone-${item.tone}`} />{item.label}</span><strong className="service-summary-count">{item.value}</strong></button>)}</div></section>
        {(needsSchedule > 0 || needsOutcome > 0) && <section className="service-summary-section blotter-pending-actions"><h3>Needs attention</h3>{needsSchedule > 0 && <button type="button" aria-pressed={selectedStatus === 'needs_schedule'} onClick={() => onStatusSelect(selectedStatus === 'needs_schedule' ? 'all' : 'needs_schedule')}><span>Needs hearing schedule</span><strong>{needsSchedule}</strong></button>}{needsOutcome > 0 && <button type="button" aria-pressed={selectedStatus === 'needs_outcome'} onClick={() => onStatusSelect(selectedStatus === 'needs_outcome' ? 'all' : 'needs_outcome')}><span>Awaiting final outcome</span><strong>{needsOutcome}</strong></button>}</section>}
      </div>
    </aside>
  </div>
}
export { isEscalated }
