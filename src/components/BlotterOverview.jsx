import { useLayoutEffect, useRef } from 'react'
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, FileWarning, ListChecks, MapPin } from 'lucide-react'
import Pill from './Pill'
import { STATUS_META } from '../data/mockBlotter'

const isPending = (r) => ['Sinuri', 'Under Review', 'Pending'].includes(r.status)
const isInvestigating = (r) => ['Inimbestigahan', 'Investigating'].includes(r.status)
const isResolved = (r) => ['Nareselba', 'Resolved'].includes(r.status)
const isEscalated = (r) => /certificate to file action|\bcfa\b/i.test(String(r.outcome || ''))

function nextAction(report) {
  if (isPending(report)) return 'Suriin at kumpirmahin ang draft'
  if (isInvestigating(report) && !report.hearingDate) return 'Itakda ang pagdinig'
  if (isInvestigating(report) && !report.hearingCompleted) return 'Subaybayan ang pagdinig'
  if (isInvestigating(report)) return 'Itala ang huling resulta'
  if (isEscalated(report)) return 'May CFA na resulta'
  if (isResolved(report)) return 'Naitala ang huling resulta'
  if (report.status === 'Spam') return 'Na-flag bilang spam'
  return 'Tingnan ang detalye'
}

function formatHearingDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('fil-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function BlotterOverview({ reports, allReports, selectedStatus, onStatusSelect, onOpen, onClearFilters }) {
  const columnsRef = useRef(null)
  useLayoutEffect(() => {
    const resize = () => {
      const element = columnsRef.current
      if (element) element.style.setProperty('--blotter-panel-height', `${Math.max(280, window.innerHeight - element.getBoundingClientRect().top - 24)}px`)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  })
  const pending = allReports.filter(isPending).length
  const inProgress = allReports.filter(isInvestigating).length
  const scheduled = allReports.filter((r) => isInvestigating(r) && r.hearingDate && !r.hearingCompleted).length
  const escalated = allReports.filter(isEscalated).length
  const resolved = allReports.filter(isResolved).length
  const needsSchedule = allReports.filter((r) => isInvestigating(r) && !r.hearingDate).length
  const needsOutcome = allReports.filter((r) => isInvestigating(r) && r.hearingCompleted).length
  const summaries = [
    { key: 'pending', label: 'Para sa pagsusuri', hint: 'Mga draft na kailangang beripikahin', value: pending, icon: Clock3, color: 'text-amber-700', bg: 'bg-amber-50' },
    { key: 'active', label: 'Iniimbestigahan', hint: 'Mga kasong nasa proseso', value: inProgress, icon: ListChecks, color: 'text-blue-700', bg: 'bg-blue-50' },
    { key: 'scheduled', label: 'May pagdinig', hint: 'May itinakdang iskedyul', value: scheduled, icon: CalendarClock, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { key: 'escalated', label: 'May CFA', hint: 'Certificate to File Action — naitalang resulta para sa pagdadala ng usapin sa korte.', value: escalated, icon: FileWarning, color: 'text-violet-700', bg: 'bg-violet-50' },
    { key: 'closed', label: 'Naresolba', hint: 'May naitalang huling resulta', value: resolved, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ]

  return <div className="mt-4 pb-8">
    <div ref={columnsRef} className="blotter-overview-columns">


    <section className="min-w-0" aria-label="Mga blotter report">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-gray-900">Mga blotter report</h3><p className="mt-0.5 text-xs text-gray-500">Piliin ang ulat para makita ang buong papel na form at kasalukuyang proseso.</p></div><span className="shrink-0 text-xs tabular-nums text-gray-500">{reports.length} resulta</span></div>
    <div className="mt-3 space-y-2.5">
      {reports.map((report) => {
        const meta = STATUS_META[report.status] || { color: 'gray' }
        const progress = isResolved(report) ? 3 : isInvestigating(report) ? 2 : 1
        return <button key={`${report.sourceTable}:${report.dbId || report.id}`} type="button" onClick={() => onOpen(report)} className="group w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:border-bb-blue/50 hover:bg-blue-50/20 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-[11px] font-bold tabular-nums text-bb-blue">{report.id}</span><span className="text-[11px] text-gray-500">{report.datetime || 'Walang petsa'}</span></div><p className="mt-1 text-sm font-bold text-gray-900">{report.title || 'Blotter report'}</p><p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"><span>Inihain ni {report.filedBy || 'hindi nakasaad'}</span>{report.location && report.location !== 'N/A' && <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={12} className="shrink-0" /><span className="truncate">{report.location}</span></span>}</p></div>
            <div className="flex shrink-0 items-center gap-3"><Pill color={meta.color} solid>{isResolved(report) ? (isEscalated(report) ? 'Isinara · May CFA' : /settlement|settled|kasunduan|nagkaareglo/i.test(report.outcome || '') ? 'Isinara · Nagkaareglo' : 'Isinara · Walang tiyak na resulta') : report.status}</Pill><ArrowRight size={16} className="text-gray-400 group-hover:text-bb-blue" /></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-100 pt-2.5 text-xs"><div className="flex items-center gap-2 text-gray-600"><span className="font-semibold text-gray-800">Susunod:</span><span>{nextAction(report)}</span></div><div className="flex items-center gap-2 text-gray-500"><span>{progress === 1 ? 'Pagsusuri' : progress === 2 ? 'Imbestigasyon' : 'Huling resulta'}</span><span className="flex gap-1" aria-label={`Yugto ${progress} sa 3`}>{[1, 2, 3].map((step) => <span key={step} className={`h-1 w-5 rounded-full ${step <= progress ? 'bg-bb-blue' : 'bg-gray-200'}`} />)}</span></div></div>
          {isInvestigating(report) && report.hearingDate && <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-indigo-700"><CalendarClock size={12} /> Pagdinig: {formatHearingDate(report.hearingDate)}</p>}
        </button>
      })}
      {reports.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center"><p className="text-sm font-semibold text-gray-800">Walang tugmang blotter report</p><p className="mt-1 text-xs text-gray-500">Subukan ang ibang salita o filter.</p><button type="button" onClick={onClearFilters} className="mt-3 text-xs font-semibold text-bb-blue hover:underline">Ipakita ang lahat</button></div>}
    </div>
    </section>
    <aside className="min-w-0" aria-label="Buod ng mga blotter report">
    <h3 className="mb-3 text-sm font-bold text-gray-900">Kalagayan ng mga ulat</h3>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
      {summaries.map(({ key, label, hint, value, icon: Icon, color, bg }) => <button key={key} type="button" onClick={() => onStatusSelect(selectedStatus === key ? 'all' : key)} aria-pressed={selectedStatus === key} className={`rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors hover:border-bb-blue/50 hover:bg-blue-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bb-blue ${selectedStatus === key ? 'border-bb-blue ring-1 ring-bb-blue/20' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg} ${color}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-gray-900">{label}</span><span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{hint}</span></span><span className="text-xl font-bold tabular-nums text-gray-900">{value}</span></div>
      </button>)}
    </div>

    {(pending > 0 || needsSchedule > 0 || needsOutcome > 0) && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600" aria-label="Mga susunod na gawain">
      <span className="font-bold text-gray-800">Susunod na gawain</span>
      {pending > 0 && <span><strong className="text-amber-700">{pending}</strong> para suriin</span>}
      {needsSchedule > 0 && <span><strong className="text-blue-700">{needsSchedule}</strong> walang iskedyul ng pagdinig</span>}
      {needsOutcome > 0 && <span><strong className="text-emerald-700">{needsOutcome}</strong> naghihintay ng huling resulta</span>}
    </div>}
    </aside>
    </div>
  </div>
}

export { isEscalated }
