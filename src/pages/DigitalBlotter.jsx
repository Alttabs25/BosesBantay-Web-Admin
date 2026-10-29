import ScopedBlotterWorkspace from '../components/ScopedBlotterWorkspace'
import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { STATUS_META } from '../data/mockBlotter'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import ConfirmDialog from '../components/ConfirmDialog'
import BlotterCreateModal from '../components/BlotterCreateModal'
import BlotterOverview, { isEscalated } from '../components/BlotterOverview'
import ReportEvidenceGallery from '../components/ReportEvidenceGallery'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES } from '../config/permissions'

const STATUS_GROUPS = [
  { value: 'all', label: 'Lahat' },
  { value: 'pending', label: 'Sinusuri' },
  { value: 'active', label: 'Ginagawa' },
  { value: 'scheduled', label: 'May pagdinig' },
  { value: 'escalated', label: 'Nai-escalate' },
  { value: 'closed', label: 'Tapos na' },
  { value: 'other', label: 'Iba pa' },
]

function statusGroup(status) {
  const value = String(status || '').toLowerCase()
  if (['resolved', 'nareselba', 'closed', 'completed', 'done'].includes(value)) return 'closed'
  if (['investigating', 'inimbestigahan', 'in progress', 'assigned', 'processing'].includes(value)) return 'active'
  if (['sinuri', 'under review', 'pending', 'for review', ''].includes(value)) return 'pending'
  return 'other'
}

function reportKey(report) {
  return `${report.sourceTable || report.reportType}:${report.dbId || report.id || report.ref}`
}

function hasReportValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '' && value !== 'N/A' && value !== 'Hindi Alam'
}

export function isServiceComplaint(report) {
  return report?.reportType === 'service_complaint' || report?.sourceTable === 'service_complaints'
}

export function isBlotterReport(report) {
  return report?.reportType === 'blotter' || report?.sourceTable === 'pre_blotters'
}

// Keep these exports for existing consumers; source metadata determines the view.
export const isHazardReport = isServiceComplaint
export const isDigitalReport = isBlotterReport

export function getReportDomId(reportId) {
  if (!reportId) return ''
  return `report-${String(reportId).replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

export function formatReportValue(val) {
  if (val === null || val === undefined || val === '') return 'N/A'
  if (typeof val === 'string') return val.trim() || 'N/A'
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (Array.isArray(val)) {
    if (val.length === 0) return 'Hindi Alam'
    return val
      .map((item) =>
        typeof item === 'object' && item !== null
          ? item?.name || item?.fullName || item?.title || JSON.stringify(item)
          : String(item)
      )
      .join(', ')
  }
  if (typeof val === 'object') {
    return (
      val?.name ||
      val?.fullName ||
      val?.title ||
      val?.summary ||
      val?.description ||
      val?.address ||
      val?.label ||
      JSON.stringify(val)
    )
  }
  return String(val)
}

export default function DigitalBlotter({ reportType = 'blotter' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isComplaintScreen = reportType === 'service_complaint'
  const { user } = useAuth()
  const {
    blotterReports,
    serviceComplaints,
    serviceComplaintsError,
    updateBlotterReport,
    addBlotterReport,
    suspendUserByName,
    addAuditEntry,
  } = useData()
  const { showToast } = useToast()

  // Safely deduplicate reports by unique report ID so only one instance of each report exists
  const uniqueReports = useMemo(() => {
    if (!Array.isArray(blotterReports)) return []
    const map = new Map()
    ;[...blotterReports, ...(serviceComplaints || [])].forEach((report) => {
      const reference = report.id || report.ref
      if (!reference) return
      const idKey = reportKey(report)
      if (!map.has(idKey)) {
        map.set(idKey, report)
      }
    })
    return Array.from(map.values())
  }, [blotterReports, serviceComplaints])

  const [query, setQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [pendingSpamId, setPendingSpamId] = useState(null)

  // Modals for mapping and creating
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const userRole = user?.role || ''
  const isAdmin = userRole === ROLES.ADMIN || userRole === 'System Administrator' || userRole.toLowerCase().includes('admin')
  const canCreateBlotter =
    userRole === ROLES.SECRETARY ||
    userRole === ROLES.CAPTAIN ||
    userRole === ROLES.LUPON ||
    userRole === ROLES.TANOD ||
    isAdmin

  const scrollToReportCard = (reportId) => {
    let attempts = 0
    const maxAttempts = 25
    const domId = getReportDomId(reportId)
    const checkAndScroll = () => {
      const el =
        document.getElementById(domId) ||
        document.getElementById(`report-${reportId}`) ||
        document.getElementById(`report-card-${reportId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightedId(reportId)
        setTimeout(() => {
          setHighlightedId((curr) => (curr === reportId ? null : curr))
        }, 2200)
      } else if (attempts < maxAttempts) {
        attempts++
        setTimeout(checkAndScroll, 35)
      }
    }
    setTimeout(checkAndScroll, 40)
  }

  // Check URL query param ?id=... from GIS navigation and auto-expand that card
  useEffect(() => {
    const targetId = searchParams.get('id')
    if (targetId && uniqueReports && uniqueReports.length > 0) {
      const found = uniqueReports.find(
        (r) => r.id === targetId || r.ref === targetId || String(r.blotterId) === String(targetId)
      )
      if (found) {
        if (isServiceComplaint(found) !== isComplaintScreen) {
          navigate(`${isServiceComplaint(found) ? '/complaints' : '/blotter'}?id=${encodeURIComponent(targetId)}`, { replace: true })
          return
        }
        setExpandedId(found.id)
        if (isComplaintScreen) scrollToReportCard(found.id)
      }
    } else if (!isComplaintScreen) {
      setExpandedId(null)
    }
  }, [searchParams, uniqueReports, isComplaintScreen, navigate])

  const filtered = useMemo(() => {
    let list = [...uniqueReports]

    list = list.filter(isComplaintScreen ? isServiceComplaint : isBlotterReport)

    // Keep report sources in one predictable order.
    list.sort((a, b) => {
      const timeA = new Date(a.rawDate).getTime() || 0
      const timeB = new Date(b.rawDate).getTime() || 0
      return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA
    })

    if (selectedStatus === 'scheduled') list = list.filter((r) => r.hearingDate && !r.hearingCompleted)
    else if (selectedStatus === 'escalated') list = list.filter(isEscalated)
    else if (selectedStatus !== 'all') list = list.filter((r) => statusGroup(r.status) === selectedStatus)
    if (selectedCategory !== 'all') list = list.filter((r) => (r.classification || r.title) === selectedCategory)
    if (dateRange !== 'all') {
      const days = Number(dateRange)
      const earliest = Date.now() - days * 24 * 60 * 60 * 1000
      list = list.filter((r) => new Date(r.rawDate).getTime() >= earliest)
    }
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        (r.id && r.id.toLowerCase().includes(q)) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.filedBy && r.filedBy.toLowerCase().includes(q)) ||
        (r.classification && r.classification.toLowerCase().includes(q)) ||
        (r.what && r.what.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.excerpt && r.excerpt.toLowerCase().includes(q)) ||
        (r.intakeDetails && Object.values(r.intakeDetails).some((value) => typeof value === 'string' && value.toLowerCase().includes(q))),
    )
  }, [uniqueReports, query, selectedStatus, selectedCategory, dateRange, isComplaintScreen, sortOrder])

  const currentTypeReports = useMemo(() => uniqueReports.filter(
    isComplaintScreen ? isServiceComplaint : isBlotterReport,
  ), [uniqueReports, isComplaintScreen])
  const statusCounts = useMemo(() => currentTypeReports.reduce((counts, report) => {
    counts[statusGroup(report.status)] += 1
    if (report.hearingDate && !report.hearingCompleted) counts.scheduled += 1
    if (isEscalated(report)) counts.escalated += 1
    return counts
  }, { pending: 0, active: 0, scheduled: 0, escalated: 0, closed: 0, other: 0 }), [currentTypeReports])
  const categories = useMemo(() => [...new Set(currentTypeReports.map((report) => report.classification || report.title).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [currentTypeReports])
  const activeFilterCount = Number(selectedStatus !== 'all') + Number(selectedCategory !== 'all') + Number(dateRange !== 'all') + Number(sortOrder !== 'newest')
  function clearFilters() {
    setSelectedStatus('all')
    setSelectedCategory('all')
    setDateRange('all')
    setSortOrder('newest')
  }

  function selectBlotterReport(report) {
    setExpandedId(report.id)
    navigate(`/blotter?id=${encodeURIComponent(report.id)}`)
  }

  function requestFlagSpam(report) {
    setPendingSpamId(report.id)
  }

  async function confirmFlagSpam() {
    const report = blotterReports.find((r) => r.id === pendingSpamId)
    if (!report) return
    try {
      await updateBlotterReport(report.id, { status: 'Spam' })
      await suspendUserByName(report.filedBy)
      addAuditEntry(`Na-flag bilang spam ang blotter ${report.id}, na-block ang account ni ${report.filedBy}`, { color: 'red' })
      showToast(`Na-flag bilang spam. Na-block ang account ni ${report.filedBy}.`)
    } catch {
      showToast(`Hindi na-save ang pagbabago sa ${report.id}. Pakisubukan muli.`, 'error')
    }
  }

  const selectedBlotter = !isComplaintScreen ? currentTypeReports.find((report) => report.id === expandedId) : null
  const showBlotterDetail = Boolean(selectedBlotter)

  return (
    <div>
      {showBlotterDetail ? <div className="flex items-center pb-2">
        <button type="button" onClick={() => { setExpandedId(null); navigate('/blotter') }} className="inline-flex items-center gap-2 rounded-lg bg-white px-2 py-2 text-base font-semibold text-gray-700 hover:border-bb-blue/50 hover:text-bb-blue"><ArrowLeft size={16} /> Bumalik sa mga ulat</button>

      </div> : <>
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-700"><span className="text-bb-blue">{filtered.length}</span> / {currentTypeReports.length} ulat</p>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <div className="min-w-[180px] flex-1 sm:w-64 sm:flex-none"><SearchInput value={query} onChange={setQuery} placeholder="Hanapin ang ulat o lokasyon" /></div>
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="report-filters" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-bb-blue/50 hover:bg-blue-50 hover:text-bb-blue">
            <SlidersHorizontal size={16} /> Mga filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          {!isComplaintScreen && canCreateBlotter && <button type="button" onClick={() => setIsCreateModalOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-bb-blue px-3 py-2 text-sm font-semibold text-white hover:bg-bb-blue-dark"><Plus size={16} /> Magdagdag</button>}
        </div>
      </div>

      {filtersOpen && <div id="report-filters" className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paliitin ang resulta</h3>
          {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-bb-blue hover:underline">I-clear ang mga filter</button>}
        </div>
        <p className="mb-3 text-xs text-gray-500">Pumili ng status, kategorya, petsa, o pagkakasunod ng mga ulat.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">Status</span><select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue">{STATUS_GROUPS.filter(({ value }) => (value !== 'other' || statusCounts.other > 0) && (!isComplaintScreen || !['scheduled', 'escalated'].includes(value))).map(({ value, label }) => <option key={value} value={value}>{label} ({value === 'all' ? currentTypeReports.length : statusCounts[value]})</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">Kategorya</span><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"><option value="all">Lahat ng kategorya</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">Saklaw ng petsa</span><select value={dateRange} onChange={(event) => setDateRange(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"><option value="all">Lahat ng petsa</option><option value="7">Huling 7 araw</option><option value="30">Huling 30 araw</option><option value="90">Huling 90 araw</option></select></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-500">Pagkakasunod</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"><option value="newest">Pinakabago</option><option value="oldest">Pinakaluma</option></select></label>
        </div>
      </div>}
      </>}

      {isComplaintScreen && serviceComplaintsError && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{serviceComplaintsError} Maaaring hindi kumpleto ang listahan.</p>
      )}

      {!isComplaintScreen && !showBlotterDetail && <BlotterOverview
        reports={filtered}
        allReports={currentTypeReports}
        selectedStatus={selectedStatus}
        onStatusSelect={setSelectedStatus}
        onOpen={selectBlotterReport}
        onClearFilters={() => { setQuery(''); clearFilters() }}
      />}

      {showBlotterDetail && <ScopedBlotterWorkspace key={selectedBlotter.id} report={selectedBlotter} onFlagSpam={requestFlagSpam} />}

      {isComplaintScreen && <div className="mt-4 space-y-3 pb-8" aria-live="polite">
        {filtered.map((report) => {
          if (isServiceComplaint(report)) {
            const isExpanded = expandedId === report.id
            const meta = STATUS_META[report.status] || { color: 'gray' }
            return (
              <article key={reportKey(report)} id={getReportDomId(report.id)} data-report-id={report.id} className={`overflow-hidden rounded-xl border bg-white transition-colors ${isExpanded || highlightedId === report.id ? 'border-bb-blue ring-2 ring-bb-blue/10 shadow-sm' : 'border-gray-200 hover:border-blue-300'}`}>
                <button type="button" onClick={() => setExpandedId(isExpanded ? null : report.id)} aria-expanded={isExpanded} className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="font-bold tabular-nums text-bb-blue">{report.id}</span>
                      <span>{formatReportValue(report.datetime)}</span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-gray-900">{formatReportValue(report.title)}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">{report.excerpt || report.location || 'Buksan para sa detalye.'}</p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500"><span>Ni {formatReportValue(report.filedBy)}</span>{hasReportValue(report.location) && <span>· {report.location}</span>}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
                    <Pill color={meta.color} solid>{report.status}</Pill>
                    <ChevronDown size={17} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-slate-50/60 px-4 py-5 sm:px-5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Detalye ng reklamo</h4>
                    <dl className="mt-3 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-semibold text-gray-500">Nagsumite</dt><dd className="mt-1 text-gray-900">{formatReportValue(report.filedBy)}</dd></div>
                      <div><dt className="text-xs font-semibold text-gray-500">Petsa at oras</dt><dd className="mt-1 text-gray-900">{formatReportValue(report.datetime)}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-xs font-semibold text-gray-500">Lokasyon</dt><dd className="mt-1 text-gray-900">{formatReportValue(report.location)}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-xs font-semibold text-gray-500">Paglalarawan</dt><dd className="mt-1 whitespace-pre-wrap leading-relaxed text-gray-900">{formatReportValue(report.excerpt)}</dd></div>
                    </dl>
                    <div className="mt-5"><ReportEvidenceGallery paths={report.photoPaths} reportId={report.id} /></div>
                  </div>
                )}
              </article>
            )
          }
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
            <p className="text-sm font-semibold text-gray-800">Walang tugmang ulat</p>
            <p className="mt-1 text-xs text-gray-500">{currentTypeReports.length === 0 ? 'Wala pang ulat sa kategoryang ito.' : 'Subukan ang ibang salita o status filter.'}</p>
            {(query || activeFilterCount > 0) && <button type="button" onClick={() => { setQuery(''); clearFilters() }} className="mt-4 text-xs font-bold text-bb-blue hover:underline">I-clear ang mga filter</button>}
          </div>
        )}
      </div>}

      <ConfirmDialog
        open={pendingSpamId != null}
        onClose={() => setPendingSpamId(null)}
        onConfirm={confirmFlagSpam}
        title="I-flag bilang Spam"
        message="Ito ay mag-block sa account ng nag-file at hindi na ito magiging opisyal na blotter record. Magpatuloy?"
        confirmLabel="I-flag bilang Spam"
      />

      <BlotterCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newReport) => addBlotterReport(newReport)}
      />
    </div>
  )
}
