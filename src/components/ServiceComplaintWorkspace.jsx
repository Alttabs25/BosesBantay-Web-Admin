import './ServiceComplaintDetails.css'
import './ServiceComplaintRegistry.css'
import BlotterMapModal from './BlotterMapModal'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import ServiceComplaintActions from './ServiceComplaintActions'
import { useLayoutEffect, useRef, useState } from 'react'
import ComplaintLocationMap from './ComplaintLocationMap'
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, LocateFixed } from 'lucide-react'
import ReportEvidenceGallery from './ReportEvidenceGallery'

function submissionDate(report) {
  const date = new Date(report.rawDate || '')
  return Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : text(report.datetime)
}
const text = value => typeof value === 'string' && value.trim() && value !== 'N/A' ? value.trim() : 'Not provided'
function complaintStatus(status) {
  const value = String(status || '').trim().toLowerCase()
  if (['sinuri','under review','pending','for review'].includes(value)) return { label: 'Under review', tone: 'blue', accent: '#315f9f', tint: '#eef4fd', border: '#c4d5ee' }
  if (['inimbestigahan','investigating','in progress','assigned','processing'].includes(value)) return { label: 'In progress', tone: 'amber', accent: '#906017', tint: '#fff7e9', border: '#ead6b1' }
  if (['nareselba','resolved','completed','done'].includes(value)) return { label: 'Resolved', tone: 'green', accent: '#2d7450', tint: '#eff8f2', border: '#c5dfcf' }
  if (value === 'spam') return { label: 'Spam', tone: 'red', accent: '#a74450', tint: '#fff2f3', border: '#ebc9ce' }
  if (value === 'out of scope') return { label: 'Out of scope', tone: 'violet', accent: '#755399', tint: '#f6f1fc', border: '#ddd0ed' }
  return { label: ['closed','cancelled','canceled'].includes(value) ? 'Closed' : status || 'Not provided', tone: 'slate', accent: '#596b82', tint: '#f2f5f8', border: '#d5dee9' }
}
function cardColors(report) {
  const status = complaintStatus(report.status)
  return { '--service-accent': status.accent, '--service-tint': status.tint, '--service-border': status.border }
}
function Status({ report }) {
  const status = complaintStatus(report.status)
  return <span className="service-status-tag" style={cardColors(report)}>{status.label}</span>
}
export default function ServiceComplaintWorkspace({ reports, selectedId, onSelect, onClose, onClear, hasFilters, total, allReports = reports, onStatusSelect, activeStatus = "all", onCategorySelect }) {
  const { user } = useAuth()
  const { fetchData } = useData()
  const [correctionReport, setCorrectionReport] = useState(null)
  const canCorrect = ['Barangay Secretary','Barangay Captain','Punong Barangay','System Administrator','Lupon Member','Lupong Tagapamayapa Member'].includes(user?.role)
  async function saveCorrection({ lat, lng, location, reason }) {
    const report = correctionReport
    if (!canCorrect || report?.sourceTable !== 'reports' || !report.dbId || !reason?.trim()) throw new Error('Hindi maaaring baguhin ang lokasyon ng record na ito.')
    const { data: current, error: readError } = await supabase.from('reports').select('id,full_details,location').eq('id', report.dbId).single()
    if (readError || !current) throw new Error('Hindi ma-load ang kasalukuyang report.')
    const details = current.full_details || {}
    if ((details.type || 'service_complaint') !== 'service_complaint') throw new Error('Hindi service complaint ang record na ito.')
    const correctedAt = new Date().toISOString()
    const pin = { latitude: lat, longitude: lng, address: location, correctedAt, correctedBy: user.id, correctedByName: user.name || 'Barangay staff', reason }
    const fullDetails = { ...details, staffLocationPin: pin, locationCorrections: [...(Array.isArray(details.locationCorrections) ? details.locationCorrections : []), { ...pin, previousPin: details.staffLocationPin || details.locationPin || null, previousAddress: current.location || '' }] }
    let query = supabase.from('reports').update({ location, full_details: fullDetails }).eq('id', report.dbId)
    query = current.location === null ? query.is('location', null) : query.eq('location', current.location)
    query = current.full_details === null ? query.is('full_details', null) : query.eq('full_details', JSON.stringify(current.full_details))
    const { data: saved, error } = await query.select('id').maybeSingle()
    if (error || !saved) throw new Error('Hindi na-save. Maaaring may ibang update; i-reload ang report at subukan muli.')
    await fetchData().catch(() => {})
    setMapReportKey(`${report.sourceTable}:${report.dbId || report.id}`)
  }
  const workspaceRef = useRef(null)
  useLayoutEffect(() => {
    const root = workspaceRef.current
    if (!root) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const height = Math.max(280, (window.visualViewport?.height || window.innerHeight) - root.getBoundingClientRect().top - 12)
        root.style.setProperty('--complaint-workspace-height', `${Math.floor(height)}px`)
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root.parentElement)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure) }
  })
  const [mapReportKey, setMapReportKey] = useState(null)
  const selectedIndex = reports.findIndex(report => report.id === selectedId)
  const selected = reports[selectedIndex]
  const selectedKey = selected ? `${selected.sourceTable}:${selected.dbId || selected.id}` : null
  const mapOpen = mapReportKey === selectedKey
  const summary = allReports.reduce((counts, report) => {
    const status = String(report.status || '').toLowerCase()
    const key = status === 'spam' ? 'spam' : status === 'out of scope' ? 'out_of_scope' : ['resolved','nareselba','closed','completed','done'].includes(status) ? 'closed' : ['investigating','inimbestigahan','in progress','assigned','processing'].includes(status) ? 'active' : ['sinuri','under review','pending','for review',''].includes(status) ? 'pending' : 'other'
    counts[key]++
    return counts
  }, { pending: 0, active: 0, closed: 0, spam: 0, out_of_scope: 0, other: 0 })
  const categoryCounts = Object.entries(allReports.reduce((counts, report) => {
    const category = report.classification || report.title || 'Other'
    counts[category] = (counts[category] || 0) + 1
    return counts
  }, {})).sort((a,b) => b[1] - a[1]).slice(0,4)
  const correctedPin = selected?.intakeDetails?.staffLocationPin
  return <div ref={workspaceRef} className={`complaint-workspace mt-4 ${selected ? 'complaint-has-selection' : ''}`}>
    <section className="complaint-list overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Service complaints">
      <div className="complaint-registry-heading"><div className="service-list-title"><h2>Service complaints</h2><span aria-label={`${reports.length} of ${total} complaints`}>{reports.length === total ? total : `${reports.length} / ${total}`}</span></div>{hasFilters && <button type="button" onClick={onClear}>Clear filters</button>}</div>
      <div className="complaint-scroll service-card-list">
        {reports.length ? reports.map(report => <button type="button" id={`report-${String(report.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`} key={`${report.sourceTable}:${report.dbId || report.id}`} onClick={() => onSelect(report)} className="service-list-card" style={cardColors(report)} aria-label={`${report.id}, ${text(report.title)}, ${report.status}`}>
          <div className="service-card-header"><div className="service-card-heading"><span className="service-card-ref">Report no. {report.id}</span><h3>{text(report.title)}</h3></div><div className="service-card-badge"><Status report={report} /></div></div>
          <p className="service-card-description">{text(report.excerpt)}</p>
          <div className="service-card-address"><span>Location</span><p>{text(report.location)}</p></div>
          <div className="service-card-footer"><div className="service-card-person"><span>Submitted by</span><p>{text(report.filedBy)}</p></div><div className="service-card-date"><span>Date submitted</span><time>{text(report.datetime)}</time></div><div className="service-card-open">{report.photoPaths?.length > 0 && <span className="service-card-photos">{report.photoPaths.length} photos</span>}<span className="service-card-view">View details <ChevronRight size={18} aria-hidden="true" /></span></div></div>
        </button>) : <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-slate-800">{total ? 'No matching complaints' : 'No complaints yet'}</p><p className="mt-2 text-xs leading-5 text-slate-500">{total ? 'Try a different search or filter.' : 'Submitted service complaints will appear here.'}</p>{hasFilters && <button type="button" onClick={onClear} className="mt-4 rounded-lg px-3 py-2 text-xs font-semibold text-bb-blue hover:bg-blue-50">Clear filters</button>}</div>}
      </div>
    </section>
    {selected && <section className="complaint-detail min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Detalye ng service complaint">
      {selected ? <>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 sm:px-6"><button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-bb-blue"><ArrowLeft size={17} /> Back to all complaints</button><div className="flex items-center gap-1"><span className="mr-2 text-[11px] tabular-nums text-slate-500">{selectedIndex + 1} / {reports.length}</span><button type="button" disabled={selectedIndex <= 0} onClick={() => onSelect(reports[selectedIndex - 1])} aria-label="Nakaraang reklamo" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-blue-50 disabled:opacity-30"><ChevronLeft size={16} /></button><button type="button" disabled={selectedIndex >= reports.length - 1} onClick={() => onSelect(reports[selectedIndex + 1])} aria-label="Susunod na reklamo" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-blue-50 disabled:opacity-30"><ChevronRight size={16} /></button></div></div>
        <div key={selectedKey} className="complaint-scroll">
        <header className="complaint-summary-header">
          <div className="complaint-summary-title"><h2>{text(selected.title)}</h2><Status report={selected} /></div>
          <p className="complaint-summary-reference">Reference <span>{selected.id}</span></p>
          <dl className="complaint-summary-fields"><div><dt>Submitted by</dt><dd>{text(selected.filedBy)}</dd></div><div><dt>Date submitted</dt><dd>{submissionDate(selected)}</dd></div></dl>
        </header>
        <div className="px-5 py-5 sm:px-6">
          <div className="space-y-5">

          <section className="complaint-description"><div className="complaint-reading-heading"><h3 className="complaint-section-title">Description</h3></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{text(selected.excerpt)}</p></section>
          <section className={`complaint-location ${mapOpen ? 'has-map' : ''}`}>
            <div className="complaint-location-copy">
              <div className="complaint-reading-heading"><h3 className="complaint-section-title">Location</h3></div>
              <p className="mt-4 break-words text-sm leading-7 text-slate-800">{text(selected.location)}</p>
              {correctedPin && <div className="complaint-location-confirmed"><span>Location verified</span>{correctedPin.correctedByName && <p>{correctedPin.correctedByName}</p>}</div>}
              <div className="complaint-location-controls">
                {Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude) && <button type="button" aria-expanded={mapOpen} onClick={() => setMapReportKey(mapOpen ? null : selectedKey)} className="complaint-map-toggle"><MapPin size={14} />{mapOpen ? 'Hide map' : 'View map'}</button>}
                {canCorrect && selected.sourceTable === 'reports' && <button type="button" onClick={() => setCorrectionReport({ ...selected, lat: selected.latitude, lng: selected.longitude })} className="complaint-repin"><LocateFixed size={14} />Re-pin location</button>}
              </div>
              {Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude) && <details className="complaint-coordinates"><summary>Coordinates</summary><p>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</p></details>}
            </div>
            {mapOpen && <ComplaintLocationMap key={selectedKey} latitude={selected.latitude} longitude={selected.longitude} />}
          </section>
          {selected.photoPaths?.length > 0 && <section className="complaint-photo-section"><ReportEvidenceGallery compact paths={selected.photoPaths} reportId={selected.id} /></section>}

          </div>
        </div>
      </div></> : <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-8 py-16 text-center"><h2 className="text-base font-semibold text-slate-800">Pumili ng reklamo</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Piliin ang isang ulat para makita ang buong detalye, lokasyon, at mga larawan.</p></div>}
    </section>}
    {!selected && <aside className="complaint-overview service-summary-panel">
      <div className="service-summary-heading"><h2>Overview</h2></div>
      <div className="complaint-scroll service-summary-body">
        <button type="button" aria-pressed={activeStatus === 'all'} onClick={() => onStatusSelect?.('all')} className={`service-summary-total ${activeStatus === 'all' ? 'is-active' : ''}`}><span>Total complaints</span><strong>{allReports.length}</strong></button>
        <section className="service-summary-section" aria-label="Filter by complaint status"><h3>Status</h3><div className="service-summary-statuses">{[
          { id: 'pending', label: 'Under review', tone: 'blue' },
          { id: 'active', label: 'In progress', tone: 'amber' },
          { id: 'closed', label: 'Closed', tone: 'green' },
          { id: 'spam', label: 'Spam', tone: 'red' },
          { id: 'out_of_scope', label: 'Out of scope', tone: 'violet' },
          ...(summary.other ? [{ id: 'other', label: 'Other status', tone: 'slate' }] : [])
        ].map(item => <button type="button" key={item.id} aria-pressed={activeStatus === item.id} onClick={() => onStatusSelect?.(item.id)} className={`service-summary-status ${activeStatus === item.id ? 'is-active' : ''}`}><span className="service-summary-status-name"><span className={`service-summary-dot tone-${item.tone}`} aria-hidden="true" />{item.label}{item.detail && <small>{item.detail}</small>}</span><strong className={`service-summary-count tone-${item.tone}`}>{summary[item.id]}</strong></button>)}</div></section>
        <section className="service-summary-section"><h3>Top categories</h3><div className="service-summary-categories">{categoryCounts.length ? categoryCounts.map(([category,count]) => <button type="button" key={category} onClick={() => onCategorySelect?.(category)}><span>{category}</span><strong>{count}</strong></button>) : <p>No category data yet.</p>}</div></section>

      </div>
    </aside>}
    {selected && <aside className="complaint-actions-panel overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Progress at actions"><div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5"><h2 className="text-sm font-semibold text-slate-900">Manage complaint</h2></div><div className="complaint-scroll p-5"><ServiceComplaintActions key={selectedKey} report={selected} /></div></aside>}
    <BlotterMapModal correction open={Boolean(correctionReport)} report={correctionReport} onClose={() => setCorrectionReport(null)} onSave={saveCorrection} />
  </div>
}
