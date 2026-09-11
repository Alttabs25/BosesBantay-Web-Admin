import { useMemo, useState, useEffect } from 'react'
import { ShieldAlert, CheckCircle2, CalendarClock, CalendarCheck2, User, Phone, MapPin, FileText, Clock } from 'lucide-react'
import { STATUS_META, OUTCOME_OPTIONS } from '../data/mockBlotter'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import ConfirmDialog from '../components/ConfirmDialog'
import StatTile from '../components/StatTile'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES } from '../config/permissions'

const FIVE_W_ONE_H = [
  ['What', 'what'],
  ['Who', 'who'],
  ['Where', 'where'],
  ['When', 'when'],
  ['Why', 'why'],
  ['How', 'how'],
]

export default function DigitalBlotter() {
  const { user } = useAuth()
  const { blotterReports, updateBlotterReport, suspendUserByName, addAuditEntry } = useData()
  const { showToast } = useToast()

  const [query, setQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [hearingDraft, setHearingDraft] = useState({ hearingDate: '', hearingNote: '' })
  const [outcomeDraft, setOutcomeDraft] = useState('')
  const [pendingSpamId, setPendingSpamId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // { type, report }

  const canConfirm = user.role === ROLES.SECRETARY || user.role === ROLES.CAPTAIN || user.role === ROLES.ADMIN
  const canManageInvestigation = user.role === ROLES.LUPON || user.role === ROLES.ADMIN

  const filtered = useMemo(() => {
    let list = [...blotterReports]

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
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.filedBy.toLowerCase().includes(q),
    )
  }, [blotterReports, query, selectedStatus])

  function expand(report) {
    setExpandedId(report.id)
    setHearingDraft({ hearingDate: report.hearingDate, hearingNote: report.hearingNote })
    setOutcomeDraft('')
  }

  function collapseReport(reportId) {
    setExpandedId(null)
    setTimeout(() => {
      const el = document.getElementById(`report-card-${reportId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 80)
  }

  useEffect(() => {
    if (expandedId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`report-card-${expandedId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 80)
      return () => clearTimeout(timer)
    }
  }, [expandedId])

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

  function confirmPendingAction() {
    if (!pendingAction) return
    const { type, report } = pendingAction
    if (type === 'confirm') confirmReport(report)
    else if (type === 'scheduleHearing') scheduleHearing(report)
    else if (type === 'markHearingHeld') markHearingHeld(report)
    else if (type === 'finalize') finalizeResolution(report)
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
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Digital Blotter</h2>
      <p className="mt-1 text-sm text-gray-500">
        Review, validate, and update incident reports.
      </p>

      {/* Analytics Section */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={FileText}
          label="Kabuuan (Total)"
          value={blotterReports.length}
          accent="blue"
          onClick={() => setSelectedStatus(null)}
          selected={selectedStatus === null}
          interactive
        />
        <StatTile
          icon={Clock}
          label="Sinuri (Pending)"
          value={blotterReports.filter(r => r.status === 'Sinuri').length}
          accent="orange"
          onClick={() => setSelectedStatus(selectedStatus === 'Sinuri' ? null : 'Sinuri')}
          selected={selectedStatus === 'Sinuri'}
          interactive
        />
        <StatTile
          icon={CalendarClock}
          label="Inimbestigahan"
          value={blotterReports.filter(r => r.status === 'Inimbestigahan').length}
          accent="blue"
          onClick={() => setSelectedStatus(selectedStatus === 'Inimbestigahan' ? null : 'Inimbestigahan')}
          selected={selectedStatus === 'Inimbestigahan'}
          interactive
        />
        <StatTile
          icon={CheckCircle2}
          label="Nareselba"
          value={blotterReports.filter(r => r.status === 'Nareselba').length}
          accent="green"
          onClick={() => setSelectedStatus(selectedStatus === 'Nareselba' ? null : 'Nareselba')}
          selected={selectedStatus === 'Nareselba'}
          interactive
        />
      </div>

      <div className="mt-6 max-w-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Hanapin ang blotter report..."
        />
      </div>

      <div className="mt-4 min-h-[300px] max-h-[calc(100vh-380px)] space-y-3 overflow-y-auto pr-2 sm:pr-3">
        {filtered.map((report) => {
          const meta = STATUS_META[report.status]
          const isExpanded = expandedId === report.id

          if (!isExpanded) {
            return (
              <div
                key={report.id}
                onClick={() => expand(report)}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">{report.id}</span>
                    <Pill color={meta.color} solid>
                      {report.status}
                    </Pill>
                  </div>
                  <h3 className="mt-1 font-bold text-gray-900">{report.title}</h3>
                  <p className="text-sm text-gray-500">
                    {report.datetime} - {report.filedBy}
                  </p>
                </div>
                <button
                  className="pointer-events-none rounded-lg bg-gradient-to-b from-gray-500 to-gray-600/90 border border-gray-500/10 shadow-xs px-4 py-1.5 text-xs font-semibold text-white"
                >
                  Tingnan ang report
                </button>
              </div>
            )
          }

          return (
            <div key={report.id} id={`report-card-${report.id}`} className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
              <div
                onClick={() => collapseReport(report.id)}
                className="bg-bb-blue p-4 text-white cursor-pointer hover:bg-bb-blue-dark transition-all select-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{report.id}</span>
                  <Pill color={meta.color} solid>
                    {report.status}
                  </Pill>
                  <div className="ml-auto flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {report.status === 'Sinuri' && canConfirm && (
                      <>
                        <button
                          onClick={() => requestConfirmReport(report)}
                          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-white to-gray-100/90 border border-gray-200 shadow-xs hover:shadow-sm text-bb-blue px-4 py-1.5 text-xs font-semibold hover:from-gray-50 hover:to-gray-150 transition-all active:scale-[0.96]"
                        >
                          <CheckCircle2 size={13} />
                          Kumpirmahin
                        </button>
                        <button
                          onClick={() => requestFlagSpam(report)}
                          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-red-600 to-red-700/90 border border-red-600/10 shadow-xs hover:shadow-sm px-4 py-1.5 text-xs font-semibold text-white hover:from-red-700 hover:to-red-800 transition-all active:scale-[0.96]"
                        >
                          <ShieldAlert size={13} />
                          I-flag bilang Spam
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <h3 className="text-lg font-bold leading-tight">{report.title}</h3>
                    <p className="text-xs text-white/80 mt-1">
                      {report.datetime} - {report.filedBy}
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
                    <span className="font-semibold text-gray-700">{report.filedBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-[120px]">
                  <Phone size={14} className="text-bb-blue shrink-0" />
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase">Contact No.</span>
                    <span className="font-semibold text-gray-700">{report.complainantPhone || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-[100px]">
                  <User size={14} className="text-bb-blue shrink-0" />
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase">Kasarian / Edad</span>
                    <span className="font-semibold text-gray-700">
                      {report.complainantGender || 'N/A'}
                      {report.complainantAge ? ` (${report.complainantAge} yrs)` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 min-w-[200px] flex-1">
                  <MapPin size={14} className="text-bb-blue shrink-0" />
                  <div>
                    <span className="block text-[10px] font-semibold text-gray-400 uppercase">Tirahan</span>
                    <span className="font-semibold text-gray-700">{report.complainantAddress || 'N/A'}</span>
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
                    <p className="mt-2 text-sm text-gray-700">{report[key]}</p>
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
                  <p className="mt-1 text-sm text-gray-600">{report.outcome}</p>
                </div>
              )}

              {report.status === 'Spam' && (
                <div className="flex items-center gap-2 border-t border-gray-100 bg-red-50 p-4 text-sm text-red-700">
                  <ShieldAlert size={16} />
                  Na-flag bilang spam ang report na ito at na-block ang account ni{' '}
                  {report.filedBy}.
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">
            Walang nahanap na blotter report.
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
    </div>
  )
}