import { useMemo, useState } from 'react'
import { ShieldAlert, CheckCircle2, CalendarClock, CalendarCheck2 } from 'lucide-react'
import { STATUS_META, OUTCOME_OPTIONS } from '../data/mockBlotter'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import ConfirmDialog from '../components/ConfirmDialog'
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
  const [expandedId, setExpandedId] = useState(null)
  const [hearingDraft, setHearingDraft] = useState({ hearingDate: '', hearingNote: '' })
  const [outcomeDraft, setOutcomeDraft] = useState('')
  const [pendingSpamId, setPendingSpamId] = useState(null)

  const canConfirm = user.role === ROLES.SECRETARY || user.role === ROLES.CAPTAIN
  const canManageInvestigation = user.role === ROLES.LUPON

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return blotterReports
    return blotterReports.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.filedBy.toLowerCase().includes(q),
    )
  }, [blotterReports, query])

  function expand(report) {
    setExpandedId(report.id)
    setHearingDraft({ hearingDate: report.hearingDate, hearingNote: report.hearingNote })
    setOutcomeDraft('')
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
    // (Re)scheduling always means the next hearing hasn't happened yet.
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

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Digital Blotter</h2>
      <p className="mt-1 text-sm text-gray-500">
        Review, validate, and update incident reports.
      </p>

      <div className="mt-4 max-w-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Hanapin ang blotter report..."
        />
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((report) => {
          const meta = STATUS_META[report.status]
          const isExpanded = expandedId === report.id

          if (!isExpanded) {
            return (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4"
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
                  onClick={() => expand(report)}
                  className="rounded-full bg-gray-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
                >
                  Tingnan ang report
                </button>
              </div>
            )
          }

          return (
            <div key={report.id} className="overflow-hidden rounded-lg border border-gray-200">
              <div className="bg-bb-blue p-4 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{report.id}</span>
                  <Pill color={meta.color} solid>
                    {report.status}
                  </Pill>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {report.status === 'Sinuri' && canConfirm && (
                      <>
                        <button
                          onClick={() => confirmReport(report)}
                          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-bb-blue hover:bg-white/90"
                        >
                          <CheckCircle2 size={13} />
                          Kumpirmahin
                        </button>
                        <button
                          onClick={() => requestFlagSpam(report)}
                          className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          <ShieldAlert size={13} />
                          I-flag bilang Spam
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <h3 className="mt-3 text-lg font-bold">{report.title}</h3>
                <p className="text-sm text-white/80">
                  {report.datetime} - {report.filedBy}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
                {FIVE_W_ONE_H.map(([label, key]) => (
                  <div key={key} className="rounded-lg border border-gray-200 p-3">
                    <span className="inline-block rounded-full bg-bb-blue-light px-2.5 py-0.5 text-xs font-semibold text-bb-blue">
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
                        onClick={() => scheduleHearing(report)}
                        className="flex items-center gap-1.5 rounded-full bg-bb-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-bb-blue-dark"
                      >
                        <CalendarClock size={13} />
                        I-iskedyul ang Pagdinig
                      </button>
                      {report.hearingDate && !report.hearingCompleted && (
                        <button
                          onClick={() => markHearingHeld(report)}
                          className="flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
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
                            onClick={() => finalizeResolution(report)}
                            className="shrink-0 rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
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

              <div className="border-t border-gray-100 p-4">
                <button
                  onClick={() => setExpandedId(null)}
                  className="rounded-full bg-gray-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
                >
                  Isara ang Report
                </button>
              </div>
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
    </div>
  )
}
