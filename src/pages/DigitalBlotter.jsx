import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldAlert, CheckCircle2, CalendarClock, CalendarCheck2, User, Phone, MapPin, FileText, Clock, Plus, X } from 'lucide-react'
import { STATUS_META, OUTCOME_OPTIONS } from '../data/mockBlotter'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import ConfirmDialog from '../components/ConfirmDialog'
import StatTile from '../components/StatTile'
import BlotterMapModal from '../components/BlotterMapModal'
import BlotterCreateModal from '../components/BlotterCreateModal'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES } from '../config/permissions'

function GisStatusPill({ isMapped }) {
  if (isMapped) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
        Naka-mapa na
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 shadow-2xs">
      <span className="h-2 w-2 rounded-full bg-gray-400 shrink-0"></span>
      Hindi naka-mapa
    </span>
  )
}

const FIVE_W_ONE_H = [
  ['What', 'what'],
  ['Who', 'who'],
  ['Where', 'where'],
  ['When', 'when'],
  ['Why', 'why'],
  ['How', 'how'],
]

const REPORT_TYPE_FILTERS = [
  { value: 'All', label: 'Lahat', activeClass: 'bg-bb-blue text-white shadow-sm' },
  { value: 'hazard', label: 'General Hazard Report', activeClass: 'bg-amber-600 text-white shadow-sm' },
  { value: 'digital', label: 'Digital Report', activeClass: 'bg-blue-600 text-white shadow-sm' },
]

const HAZARD_CATEGORIES = new Set([
  'flooding / drainage',
  'flooding',
  'drainage',
  'baha',
  'damaged facility',
  'other hazard',
  'hazard',
  'general hazard',
  'general hazard report',
  'fire hazard',
  'sunog',
  'garbage / waste',
  'waste',
  'basura',
  'debris',
  'electrical hazard',
  'kuryente',
  'fallen tree',
  'broken streetlight',
  'sirang kalsada',
  'road obstruction',
  'infrastructure',
])

export function isHazardReport(report) {
  if (!report) return false
  if (report.isHazard === true) return true
  if (report.isHazard === false) return false

  const type = String(report.reportType || '').trim().toLowerCase()
  if (type === 'hazard' || type === 'general_hazard' || type === 'general hazard' || type === 'hazard_report') {
    return true
  }

  if (report.isFormReport === true) {
    return true
  }

  const title = String(report.title || '').trim().toLowerCase()
  const classification = String(report.classification || '').trim().toLowerCase()
  const category = String(report.category || '').trim().toLowerCase()
  const what = String(report.what || '').trim().toLowerCase()

  if (
    HAZARD_CATEGORIES.has(title) ||
    HAZARD_CATEGORIES.has(classification) ||
    HAZARD_CATEGORIES.has(category) ||
    HAZARD_CATEGORIES.has(what)
  ) {
    return true
  }

  const hazardKeywords = [
    'hazard',
    'flood',
    'drainage',
    'baha',
    'damaged facility',
    'fire',
    'sunog',
    'garbage',
    'waste',
    'basura',
    'debris',
    'electrical',
    'kuryente',
    'fallen tree',
    'broken streetlight',
    'sirang kalsada',
    'road obstruction',
    'infrastructure',
  ]

  if (hazardKeywords.some((kw) => title.includes(kw) || classification.includes(kw) || category.includes(kw))) {
    return true
  }

  if (
    String(report.id || '').startsWith('REP-') ||
    String(report.id || '').startsWith('HAZ-') ||
    String(report.id || '').startsWith('GH-')
  ) {
    return true
  }

  return false
}

export function isDigitalReport(report) {
  if (!report) return false
  return !isHazardReport(report)
}

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

export default function DigitalBlotter() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    blotterReports,
    incidents,
    updateBlotterReport,
    addBlotterReport,
    mapIncidentLocation,
    unmapIncidentLocation,
    suspendUserByName,
    addAuditEntry,
  } = useData()
  const { showToast } = useToast()

  // Safely deduplicate reports by unique report ID so only one instance of each report exists
  const uniqueReports = useMemo(() => {
    if (!blotterReports || !Array.isArray(blotterReports)) return []
    const map = new Map()
    blotterReports.forEach((report) => {
      const idKey = report.id || report.ref
      if (idKey && !map.has(idKey)) {
        map.set(idKey, report)
      }
    })
    return Array.from(map.values())
  }, [blotterReports])

  const checkIsMapped = (report) => {
    if (!report) return false
    if (report.is_mapped === true || report.isMapped === true) return true
    if (
      report.mapStatus === 'Approved' &&
      report.lat != null &&
      report.lng != null &&
      !isNaN(report.lat) &&
      !isNaN(report.lng)
    ) {
      return true
    }
    const matchingIncident = incidents?.find(
      (i) =>
        i.ref === report.id ||
        i.id === report.id ||
        i.ref === report.ref ||
        i.id === report.ref ||
        (report.blotterId && String(i.blotterId) === String(report.blotterId))
    )
    if (matchingIncident) {
      const hasCoords =
        matchingIncident.lat != null &&
        matchingIncident.lng != null &&
        !isNaN(matchingIncident.lat) &&
        !isNaN(matchingIncident.lng)
      if (
        hasCoords &&
        (matchingIncident.is_mapped === true ||
          matchingIncident.isMapped === true ||
          matchingIncident.mapStatus === 'Approved')
      ) {
        return true
      }
    }
    return false
  }

  const handleOpenMapping = (report) => {
    const matchingInc = incidents?.find(
      (i) =>
        i.ref === report.id ||
        i.id === report.id ||
        i.ref === report.ref ||
        i.id === report.ref ||
        (report.blotterId && String(i.blotterId) === String(report.blotterId))
    )
    const enrichedReport = {
      ...report,
      lat: report.lat ?? matchingInc?.lat ?? null,
      lng: report.lng ?? matchingInc?.lng ?? null,
      location: report.location || matchingInc?.location || '',
    }
    setMappingReport(enrichedReport)
  }

  const [query, setQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [reportTypeFilter, setReportTypeFilter] = useState('All')
  const [expandedId, setExpandedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [hearingDraft, setHearingDraft] = useState({ hearingDate: '', hearingNote: '' })
  const [outcomeDraft, setOutcomeDraft] = useState('')
  const [pendingSpamId, setPendingSpamId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // { type, report }

  // Modals for mapping and creating
  const [mappingReport, setMappingReport] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const userRole = user?.role || ''
  const isAdmin = userRole === ROLES.ADMIN || userRole === 'System Administrator' || userRole.toLowerCase().includes('admin')
  const canConfirm = userRole === ROLES.SECRETARY || userRole === ROLES.CAPTAIN || isAdmin
  const canManageInvestigation = userRole === ROLES.LUPON || isAdmin
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
        if (reportTypeFilter === 'hazard' && !isHazardReport(found)) {
          setReportTypeFilter('All')
        } else if (reportTypeFilter === 'digital' && !isDigitalReport(found)) {
          setReportTypeFilter('All')
        }
        if (selectedStatus && found.status !== selectedStatus) {
          setSelectedStatus(null)
        }
        setExpandedId(found.id)
        setHearingDraft({
          hearingDate: found.hearingDate || '',
          hearingNote: found.hearingNote || '',
        })
        scrollToReportCard(found.id)
      }
    }
  }, [searchParams, uniqueReports])

  const filtered = useMemo(() => {
    let list = [...uniqueReports]

    // Filter by report type (General Hazard vs Digital Report)
    if (reportTypeFilter === 'hazard') {
      list = list.filter(isHazardReport)
    } else if (reportTypeFilter === 'digital') {
      list = list.filter(isDigitalReport)
    }

    // Sort by oldest first so newest reports appear at the bottom
    list.sort((a, b) => {
      const timeA = new Date(a.rawDate).getTime() || 0
      const timeB = new Date(b.rawDate).getTime() || 0
      return timeA - timeB
    })

    if (selectedStatus) {
      list = list.filter((r) => r.status === selectedStatus)
    }
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        (r.id && r.id.toLowerCase().includes(q)) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.filedBy && r.filedBy.toLowerCase().includes(q)) ||
        (r.classification && r.classification.toLowerCase().includes(q)) ||
        (r.what && r.what.toLowerCase().includes(q)),
    )
  }, [uniqueReports, query, selectedStatus, reportTypeFilter])

  function handleViewReport(reportOrId) {
    if (!reportOrId) {
      showToast('Hindi natagpuan ang report. Pakisubukang muli.', 'error')
      return
    }

    const targetId =
      typeof reportOrId === 'object'
        ? reportOrId.id || reportOrId.ref
        : reportOrId

    const foundReport =
      uniqueReports.find(
        (r) =>
          r.id === targetId ||
          r.ref === targetId ||
          (r.blotterId && String(r.blotterId) === String(targetId))
      ) || (typeof reportOrId === 'object' ? reportOrId : null)

    if (!foundReport || !foundReport.id) {
      showToast('Hindi natagpuan ang report. Pakisubukang muli.', 'error')
      return
    }

    // If report would be hidden by current filter, switch appropriately
    if (reportTypeFilter === 'hazard' && !isHazardReport(foundReport)) {
      setReportTypeFilter('All')
    } else if (reportTypeFilter === 'digital' && !isDigitalReport(foundReport)) {
      setReportTypeFilter('All')
    }

    if (selectedStatus && foundReport.status !== selectedStatus) {
      setSelectedStatus(null)
    }

    const q = query.trim().toLowerCase()
    if (
      q &&
      !foundReport.id?.toLowerCase().includes(q) &&
      !foundReport.title?.toLowerCase().includes(q) &&
      !foundReport.filedBy?.toLowerCase().includes(q)
    ) {
      setQuery('')
    }

    setExpandedId(foundReport.id)
    setHearingDraft({
      hearingDate: foundReport.hearingDate || '',
      hearingNote: foundReport.hearingNote || '',
    })
    setOutcomeDraft('')

    scrollToReportCard(foundReport.id)
  }

  function expand(report) {
    if (!report || !report.id) {
      showToast('Hindi natagpuan ang report. Pakisubukang muli.', 'error')
      return
    }
    const isCurrentlyExpanded = expandedId === report.id
    if (isCurrentlyExpanded) {
      setExpandedId(null)
      return
    }
    handleViewReport(report)
  }

  function collapseReport() {
    setExpandedId(null)
  }

  function confirmReport(report) {
    updateBlotterReport(report.id, { status: 'Inimbestigahan' })
    addAuditEntry(`Kinumpirma ang blotter ${report.id}`, { color: 'blue' })
    showToast(`${report.id}: naitala na sa permanenteng ledger, isinusulong sa Investigating.`)
  }

  function requestFlagSpam(report) {
    setPendingSpamId(report.id)
  }

  function confirmFlagSpam() {
    const report = blotterReports.find((r) => r.id === pendingSpamId)
    if (!report) return
    updateBlotterReport(report.id, { status: 'Spam' })
    suspendUserByName(report.filedBy)
    addAuditEntry(`Na-flag bilang spam ang blotter ${report.id}, na-block ang account ni ${report.filedBy}`, {
      color: 'red',
    })
    showToast(`Na-flag bilang spam. Na-block ang account ni ${report.filedBy}.`)
  }

  function scheduleHearing(report) {
    if (!hearingDraft.hearingDate) {
      showToast('Pumili muna ng petsa ng pagdinig.', 'error')
      return
    }
    updateBlotterReport(report.id, { ...hearingDraft, hearingCompleted: false })
    addAuditEntry(`In-iskedyul ang pagdinig sa Barangay Hall para sa ${report.id}`, { color: 'blue' })
    showToast('Naka-iskedyul na ang pagdinig sa Barangay Hall.')
  }

  function markHearingHeld(report) {
    updateBlotterReport(report.id, { hearingCompleted: true })
    addAuditEntry(`Naitala na naganap na ang pagdinig para sa ${report.id}`, { color: 'blue' })
    showToast('Naitala na naganap ang pagdinig. Maaari na itong i-finalize.')
  }

  function finalizeResolution(report) {
    if (!outcomeDraft) {
      showToast('Pumili muna ng huling resulta.', 'error')
      return
    }
    updateBlotterReport(report.id, {
      status: 'Nareselba',
      outcome: outcomeDraft,
      hearingDate: '',
      hearingNote: '',
      hearingCompleted: false,
    })
    addAuditEntry(`Na-finalize ang blotter ${report.id} bilang Nareselba`, { color: 'green' })
    showToast(`${report.id}: na-mark bilang Nalutas.`)
    setOutcomeDraft('')
  }

  function requestConfirmReport(report) {
    setPendingAction({ type: 'confirm', report })
  }

  function requestScheduleHearing(report) {
    if (!hearingDraft.hearingDate) {
      showToast('Pumili muna ng petsa ng pagdinig.', 'error')
      return
    }
    setPendingAction({ type: 'scheduleHearing', report })
  }

  function requestMarkHearingHeld(report) {
    setPendingAction({ type: 'markHearingHeld', report })
  }

  function requestFinalize(report) {
    if (!outcomeDraft) {
      showToast('Pumili muna ng huling resulta.', 'error')
      return
    }
    setPendingAction({ type: 'finalize', report })
  }

  function requestUnmap(report) {
    setPendingAction({ type: 'unmap', report })
  }

  async function confirmPendingAction() {
    if (!pendingAction) return
    const { type, report } = pendingAction
    if (type === 'confirm') confirmReport(report)
    else if (type === 'scheduleHearing') scheduleHearing(report)
    else if (type === 'markHearingHeld') markHearingHeld(report)
    else if (type === 'finalize') finalizeResolution(report)
    else if (type === 'unmap') {
      try {
        await unmapIncidentLocation(report.id)
        showToast(`Inalis sa GIS map ang ${report.id}. Mananatili ang record sa Digital Reports.`)
      } catch (err) {
        showToast(err.message || 'Hindi na-save ang mapping ng insidente. Pakisubukan muli.', 'error')
      }
    }
    setPendingAction(null)
  }

  const PENDING_ACTION_META = {
    confirm: {
      title: 'Kumpirmahin ang Blotter Report',
      message: (report) =>
        `Isusulong ang ${report.id} mula Sinuri patungong Inimbestigahan bilang permanenteng ledger entry. Magpatuloy?`,
      confirmLabel: 'Kumpirmahin',
      danger: false,
    },
    scheduleHearing: {
      title: 'I-iskedyul ang Pagdinig',
      message: (report) =>
        `Iiskedyul ang pagdinig sa Barangay Hall para sa ${report.id} sa napiling petsa. Magpatuloy?`,
      confirmLabel: 'I-iskedyul',
      danger: false,
    },
    markHearingHeld: {
      title: 'Markahan na Naganap ang Pagdinig',
      message: (report) =>
        `Kukumpirmahin na naganap na ang pagdinig para sa ${report.id}, at magiging available na ito para sa case finalization. Magpatuloy?`,
      confirmLabel: 'Markahan',
      danger: false,
    },
    finalize: {
      title: 'I-finalize ang Kaso',
      message: (report) =>
        `Ito ay markahan ang ${report.id} bilang Nalutas na may resultang "${outcomeDraft}". Hindi na ito babaguhin pagkatapos. Magpatuloy?`,
      confirmLabel: 'Markahan bilang Nalutas',
      danger: false,
    },
    unmap: {
      title: 'Alisin sa Mapa',
      message: (report) =>
        `Alisin ang insidenteng ito (${report.id}) sa GIS map? Mananatili ang blotter report ngunit mawawala ang pin nito sa mapa.`,
      confirmLabel: 'Alisin sa Mapa',
      danger: true,
    },
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Digital Reports</h2>
          <p className="mt-1 text-sm text-gray-500">
            Suriin, kumpirmahin, at i-map ang mga blotter report at insidente.
          </p>
        </div>
        {canCreateBlotter && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-bb-blue hover:bg-bb-blue-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus size={16} />
            Magdagdag ng Insidente
          </button>
        )}
      </div>

      {/* Analytics Section */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={FileText}
          label="Kabuuan (Total)"
          value={uniqueReports.length}
          accent="blue"
          onClick={() => setSelectedStatus(null)}
          selected={selectedStatus === null}
          interactive
        />
        <StatTile
          icon={Clock}
          label="Sinuri (Pending)"
          value={uniqueReports.filter((r) => r.status === 'Sinuri').length}
          accent="orange"
          onClick={() => setSelectedStatus(selectedStatus === 'Sinuri' ? null : 'Sinuri')}
          selected={selectedStatus === 'Sinuri'}
          interactive
        />
        <StatTile
          icon={CalendarClock}
          label="Inimbestigahan"
          value={uniqueReports.filter((r) => r.status === 'Inimbestigahan').length}
          accent="blue"
          onClick={() => setSelectedStatus(selectedStatus === 'Inimbestigahan' ? null : 'Inimbestigahan')}
          selected={selectedStatus === 'Inimbestigahan'}
          interactive
        />
        <StatTile
          icon={CheckCircle2}
          label="Nareselba"
          value={uniqueReports.filter((r) => r.status === 'Nareselba').length}
          accent="green"
          onClick={() => setSelectedStatus(selectedStatus === 'Nareselba' ? null : 'Nareselba')}
          selected={selectedStatus === 'Nareselba'}
          interactive
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-md">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Hanapin ang report..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-gray-50/50 rounded-xl p-1.5">
          {REPORT_TYPE_FILTERS.map((pill) => {
            const count =
              pill.value === 'All'
                ? uniqueReports.length
                : pill.value === 'hazard'
                  ? uniqueReports.filter(isHazardReport).length
                  : uniqueReports.filter(isDigitalReport).length
            const isActive = reportTypeFilter === pill.value

            return (
              <button
                key={pill.value}
                onClick={() => setReportTypeFilter(pill.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${isActive
                  ? `${pill.activeClass} scale-102`
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-500 border border-gray-200/50'
                    }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 space-y-3 pb-8">
        {filtered.map((report) => {
          const meta = STATUS_META[report.status] || { color: 'gray' }
          const isExpanded = expandedId === report.id
          const isVerified = report.status !== 'Sinuri' && report.status !== 'Under Review' && report.status !== 'Spam'
          const isHazard = isHazardReport(report)
          const domId = getReportDomId(report.id)

          if (!isExpanded) {
            return (
              <div
                key={report.id}
                id={domId}
                data-report-id={report.id}
                onClick={() => expand(report)}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 ${
                  highlightedId === report.id
                    ? 'border-bb-blue ring-2 ring-bb-blue/50 bg-blue-50/40 shadow-sm'
                    : 'border-gray-200'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">{report.id}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${isHazard
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                    >
                      {isHazard ? 'General Hazard' : 'Digital Report'}
                    </span>
                    <Pill color={meta.color} solid>
                      {report.status}
                    </Pill>
                    {isVerified && <GisStatusPill isMapped={checkIsMapped(report)} />}
                  </div>
                  <h3 className="mt-1 font-bold text-gray-900">{formatReportValue(report.title)}</h3>
                  <p className="text-sm text-gray-500">
                    {formatReportValue(report.datetime)} - {formatReportValue(report.filedBy)}
                  </p>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {isVerified ? (
                    checkIsMapped(report) ? (
                      <button
                        onClick={() => navigate(`/gis?id=${report.id}`)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.96] cursor-pointer shadow-2xs"
                        title="Tingnan sa GIS Command Center map"
                      >
                        <MapPin size={13} />
                        Tingnan sa Mapa
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenMapping(report)}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-bb-blue border border-blue-200 px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.96] cursor-pointer shadow-2xs"
                        title="I-map ang insidenteng ito sa GIS map"
                      >
                        <MapPin size={13} />
                        I-map ang insidente
                      </button>
                    )
                  ) : (
                    canConfirm && report.status === 'Sinuri' && (
                      <>
                        <button
                          onClick={() => requestConfirmReport(report)}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-bb-blue border border-blue-200 px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.96] cursor-pointer shadow-2xs"
                          title="Kumpirmahin ang ulat at itala sa permanenteng ledger"
                        >
                          <CheckCircle2 size={13} />
                          Kumpirmahin
                        </button>
                        <button
                          onClick={() => requestFlagSpam(report)}
                          className="flex items-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.96] cursor-pointer shadow-2xs"
                          title="I-flag bilang Spam"
                        >
                          <ShieldAlert size={13} />
                          I-flag bilang Spam
                        </button>
                      </>
                    )
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewReport(report.id)
                    }}
                    className="rounded-lg bg-gradient-to-b from-gray-600 to-gray-700/90 border border-gray-500/10 shadow-xs px-4 py-1.5 text-xs font-semibold text-white hover:from-gray-700 hover:to-gray-800 transition-all cursor-pointer"
                  >
                    Tingnan ang report
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={report.id}
              id={domId}
              data-report-id={report.id}
              className={`overflow-hidden rounded-lg border shadow-sm transition-all duration-200 ${
                highlightedId === report.id
                  ? 'border-bb-blue ring-2 ring-bb-blue/50 shadow-md'
                  : 'border-gray-200'
              }`}
            >
              <div
                onClick={() => collapseReport()}
                className="bg-bb-blue p-4 text-white cursor-pointer hover:bg-bb-blue-dark transition-all select-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{report.id}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${isHazard
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                      : 'bg-white/20 text-white border-white/20'
                      }`}
                  >
                    {isHazard ? 'General Hazard' : 'Digital Report'}
                  </span>
                  <Pill color={meta.color} solid>
                    {report.status}
                  </Pill>
                  {isVerified && <GisStatusPill isMapped={checkIsMapped(report)} />}
                  <div className="ml-auto flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isVerified ? (
                      checkIsMapped(report) ? (
                        <>
                          <button
                            onClick={() => navigate(`/gis?id=${report.id}`)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-600/10 shadow-xs px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.96] cursor-pointer"
                            title="Tingnan sa GIS Command Center map"
                          >
                            <MapPin size={13} />
                            Tingnan sa Mapa
                          </button>
                          <button
                            onClick={() => handleOpenMapping(report)}
                            className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.96] cursor-pointer"
                            title="Baguhin ang lokasyon sa mapa"
                          >
                            <MapPin size={13} />
                            Baguhin ang Lokasyon
                          </button>
                          <button
                            onClick={() => requestUnmap(report)}
                            className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 border border-rose-600/10 shadow-xs px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.96] cursor-pointer"
                            title="Alisin sa GIS map"
                          >
                            <X size={13} />
                            Alisin sa Mapa
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenMapping(report)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-600/10 shadow-xs px-3.5 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.96] cursor-pointer"
                          title="I-map ang insidente sa mapa"
                        >
                          <MapPin size={13} />
                          I-map ang insidente
                        </button>
                      )
                    ) : (
                      report.status === 'Sinuri' && canConfirm && (
                        <>
                          <button
                            onClick={() => requestConfirmReport(report)}
                            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-white to-gray-100/90 border border-gray-200 shadow-xs hover:shadow-sm text-bb-blue px-3.5 py-1.5 text-xs font-semibold hover:from-gray-50 hover:to-gray-150 transition-all active:scale-[0.96] cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            Kumpirmahin
                          </button>
                          <button
                            onClick={() => requestFlagSpam(report)}
                            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-red-600 to-red-700/90 border border-red-600/10 shadow-xs hover:shadow-sm px-3.5 py-1.5 text-xs font-semibold text-white hover:from-red-700 hover:to-red-800 transition-all active:scale-[0.96] cursor-pointer"
                          >
                            <ShieldAlert size={13} />
                            I-flag bilang Spam
                          </button>
                        </>
                      )
                    )}
                  </div>
                </div>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <h3 className="text-lg font-bold leading-tight">{formatReportValue(report.title)}</h3>
                    <p className="text-xs text-white/80 mt-1">
                      {formatReportValue(report.datetime)} - {formatReportValue(report.filedBy)}
                    </p>
                  </div>
                  <span className="text-[10px] bg-white/10 hover:bg-white/20 border border-white/10 px-2.5 py-1 rounded text-white/90 font-medium transition-all">
                    I-collapse ang Report
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5 min-w-[140px]">
                  <User size={14} className="text-bb-blue shrink-0" />
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase">Nagrereklamo</span>
                    <span className="font-semibold text-gray-700">{formatReportValue(report.filedBy)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-[120px]">
                  <Phone size={14} className="text-bb-blue shrink-0" />
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase">Contact No.</span>
                    <span className="font-semibold text-gray-700">{formatReportValue(report.complainantPhone)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-[100px]">
                  <User size={14} className="text-bb-blue shrink-0" />
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase">Kasarian / Edad</span>
                    <span className="font-semibold text-gray-700">
                      {formatReportValue(report.complainantGender)}
                      {report.complainantAge ? ` (${formatReportValue(report.complainantAge)} yrs)` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-[200px] flex-1">
                  <MapPin size={14} className="text-bb-blue shrink-0" />
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase">Tirahan</span>
                    <span className="font-semibold text-gray-700">{formatReportValue(report.complainantAddress)}</span>
                  </div>
                </div>
                {report.isMinor && (
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                    <ShieldAlert size={12} />
                    Menor de Edad (Minor)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
                {FIVE_W_ONE_H.map(([label, key]) => (
                  <div key={key} className="rounded-lg border border-gray-200 p-3">
                    <span className="inline-block rounded-md bg-bb-blue-light px-2.5 py-0.5 text-xs font-semibold text-bb-blue">
                      {label}
                    </span>
                    <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{formatReportValue(report[key])}</p>
                  </div>
                ))}
              </div>

              {report.status === 'Inimbestigahan' && (
                <div className="border-t border-gray-100 p-4">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                    <CalendarClock size={15} />
                    Iskedyul ng Pagdinig sa Barangay Hall
                  </h4>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-gray-500">
                        Susunod na Petsa ng Pagdinig
                      </span>
                      <input
                        type="datetime-local"
                        disabled={!canManageInvestigation}
                        value={hearingDraft.hearingDate}
                        onChange={(e) =>
                          setHearingDraft((d) => ({ ...d, hearingDate: e.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                      />
                    </label>
                    <label className="block sm:col-span-1">
                      <span className="mb-1 block text-xs font-semibold text-gray-500">
                        Tala sa Huling Session
                      </span>
                      <textarea
                        rows={2}
                        disabled={!canManageInvestigation}
                        value={hearingDraft.hearingNote}
                        onChange={(e) =>
                          setHearingDraft((d) => ({ ...d, hearingNote: e.target.value }))
                        }
                        placeholder="hal. 1st meeting, July 20, sumang-ayon magkita ulit sa susunod na linggo"
                        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                      />
                    </label>
                  </div>

                  {canManageInvestigation && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => requestScheduleHearing(report)}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-xs hover:shadow-sm hover:from-bb-blue-dark hover:to-bb-blue-dark px-4 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.96]"
                      >
                        <CalendarClock size={13} />
                        I-iskedyul ang Pagdinig
                      </button>
                      {report.hearingDate && !report.hearingCompleted && (
                        <button
                          onClick={() => requestMarkHearingHeld(report)}
                          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-green-600 to-green-700/90 border border-green-600/10 shadow-xs hover:shadow-sm px-4 py-1.5 text-xs font-semibold text-white hover:from-green-700 hover:to-green-800 transition-all active:scale-[0.96]"
                        >
                          <CalendarCheck2 size={13} />
                          Markahan na Naganap ang Pagdinig
                        </button>
                      )}
                    </div>
                  )}

                  {report.hearingCompleted ? (
                    canConfirm && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <h4 className="text-sm font-semibold text-gray-700">
                          I-finalize ang Kaso
                        </h4>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <select
                            value={outcomeDraft}
                            onChange={(e) => setOutcomeDraft(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                          >
                            <option value="">Piliin ang huling resulta...</option>
                            {OUTCOME_OPTIONS.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => requestFinalize(report)}
                            className="shrink-0 rounded-lg bg-gradient-to-b from-green-600 to-green-700/90 border border-green-600/10 shadow-xs hover:shadow-sm px-4 py-2 text-xs font-semibold text-white hover:from-green-700 hover:to-green-800 transition-all active:scale-[0.98]"
                          >
                            Markahan bilang Nalutas
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    canConfirm && (
                      <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-400">
                        {report.hearingDate
                          ? 'Maghintay munang matapos ang naka-iskedyul na pagdinig bago ma-finalize ang kaso.'
                          : 'Kailangan munang mag-iskedyul ng pagdinig sa Barangay Hall bago ma-finalize ang kaso.'}
                      </p>
                    )
                  )}
                </div>
              )}

              {report.status === 'Nareselba' && report.outcome && (
                <div className="border-t border-gray-100 p-4">
                  <h4 className="text-sm font-semibold text-gray-700">Huling Resulta</h4>
                  <p className="mt-1 text-sm text-gray-600">{formatReportValue(report.outcome)}</p>
                </div>
              )}

              {report.status === 'Spam' && (
                <div className="flex items-center gap-2 border-t border-gray-100 bg-red-50 p-4 text-sm text-red-700">
                  <ShieldAlert size={16} />
                  Na-flag bilang spam ang report na ito at na-block ang account ni{' '}
                  {formatReportValue(report.filedBy)}.
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">
            Walang nahanap na report.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={pendingSpamId != null}
        onClose={() => setPendingSpamId(null)}
        onConfirm={confirmFlagSpam}
        title="I-flag bilang Spam"
        message="Ito ay mag-block sa account ng nag-file at hindi na ito magiging opisyal na blotter record. Magpatuloy?"
        confirmLabel="I-flag bilang Spam"
      />

      <ConfirmDialog
        open={pendingAction != null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        title={pendingAction ? PENDING_ACTION_META[pendingAction.type].title : ''}
        message={pendingAction ? PENDING_ACTION_META[pendingAction.type].message(pendingAction.report) : ''}
        confirmLabel={pendingAction ? PENDING_ACTION_META[pendingAction.type].confirmLabel : 'Kumpirmahin'}
        danger={pendingAction ? PENDING_ACTION_META[pendingAction.type].danger : false}
      />

      <BlotterMapModal
        open={mappingReport != null}
        onClose={() => setMappingReport(null)}
        report={mappingReport}
        onSave={(data) => mapIncidentLocation(mappingReport?.id || mappingReport?.ref, { ...data, report: mappingReport })}
      />

      <BlotterCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newReport) => addBlotterReport(newReport)}
      />
    </div>
  )
}