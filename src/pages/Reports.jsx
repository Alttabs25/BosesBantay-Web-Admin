import { useMemo, useState } from 'react'
import { Download, Printer, FileBarChart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { ROLES, can } from '../config/permissions'
import { ALL_CLASSIFICATIONS } from '../data/mockIncidents'
import { downloadCSV } from '../lib/csvExport'
import StatTile from '../components/StatTile'
import MiniBarChart from '../components/MiniBarChart'

const DATE_RANGES = ['Lahat ng Petsa', 'Huling 7 Araw', 'Huling 30 Araw', 'Custom Range']

function inDateRange(dateISO, range, customStart, customEnd) {
  if (range === 'Lahat ng Petsa') return true
  if (range === 'Huling 7 Araw') {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return new Date(dateISO).getTime() >= cutoff
  }
  if (range === 'Huling 30 Araw') {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    return new Date(dateISO).getTime() >= cutoff
  }
  if (range === 'Custom Range') {
    if (!dateISO) return false
    const time = new Date(dateISO).getTime()
    const start = customStart ? new Date(customStart + 'T00:00:00').getTime() : 0
    const end = customEnd ? new Date(customEnd + 'T23:59:59').getTime() : Infinity
    return time >= start && time <= end
  }
  return true
}

function countBy(items, keyFn) {
  const counts = {}
  items.forEach((item) => {
    const key = keyFn(item) || 'Hindi Tinukoy'
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts).map(([label, value]) => ({ label, value, color: 'blue' }))
}

export default function Reports() {
  const { user } = useAuth()
  const { incidents, blotterReports, addAuditEntry } = useData()
  const { showToast } = useToast()

  const canExport = can(user.role, 'reports', 'create')

  const classifications = useMemo(
    () => [ALL_CLASSIFICATIONS, ...new Set(incidents.map((i) => i.classification))],
    [incidents],
  )

  const [dateRange, setDateRange] = useState(DATE_RANGES[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [classification, setClassification] = useState(ALL_CLASSIFICATIONS)
  const [generated, setGenerated] = useState(false)

  const scopedIncidents = useMemo(() => {
    return incidents.filter((i) => {
      if (!inDateRange(i.dateISO, dateRange, startDate, endDate)) return false
      if (classification !== ALL_CLASSIFICATIONS && i.classification !== classification) return false
      return true
    })
  }, [incidents, dateRange, classification, startDate, endDate])

  const typeData = useMemo(() => countBy(scopedIncidents, (i) => i.classification), [scopedIncidents])
  const sectorData = useMemo(() => countBy(scopedIncidents, (i) => i.sector), [scopedIncidents])
  const statusData = useMemo(
    () => [
      { label: 'Sinuri', value: blotterReports.filter((r) => r.status === 'Sinuri').length, color: 'orange' },
      { label: 'Inimbestigahan', value: blotterReports.filter((r) => r.status === 'Inimbestigahan').length, color: 'blue' },
      { label: 'Nareselba', value: blotterReports.filter((r) => r.status === 'Nareselba').length, color: 'green' },
      { label: 'Spam', value: blotterReports.filter((r) => r.status === 'Spam').length, color: 'red' },
    ],
    [blotterReports],
  )

  const assignedCases = useMemo(
    () => blotterReports.filter((r) => r.status === 'Inimbestigahan'),
    [blotterReports],
  )

  function handleGenerate() {
    // If Custom Range is selected, warn if start or end date is missing
    if (dateRange === 'Custom Range' && (!startDate || !endDate)) {
      showToast('Mangyaring piliin ang parehong Start at End Date para sa Custom Range.', 'error')
      return
    }
    setGenerated(true)
    addAuditEntry('Bumuo ng report summary', { color: 'blue' })
  }

  function handleExportCSV() {
    const rows = [
      ['Kategorya', 'Label', 'Bilang'],
      ...typeData.map((r) => ['Insidente ayon sa Uri ng Insidente', r.label, r.value]),
      ...sectorData.map((r) => ['Kabuuan ayon sa Sektor', r.label, r.value]),
      ...statusData.map((r) => ['Status Breakdown', r.label, r.value]),
    ]
    downloadCSV(`bosesbantay-report-${Date.now()}.csv`, rows)
    showToast('Nai-download na ang Spreadsheet (CSV) report summary.', 'success')
    addAuditEntry('Nag-export ng report bilang spreadsheet (CSV)', { color: 'green' })
  }

  function handlePrint() {
    addAuditEntry('Nag-export ng report bilang PDF (print)', { color: 'green' })
    setTimeout(() => {
      window.print()
      showToast('Nai-export na ang PDF report summary.', 'success')
    }, 150)
  }

  // Lupong Tagapamayapa: scoped to a fixed "assigned case summary" view only.
  if (user.role === ROLES.LUPON) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900">Buod ng Nakatalagang Kaso</h2>
        <p className="mt-1 text-sm text-gray-500">
          Basahin lamang na buod ng mga kasong kasalukuyang Investigating.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatTile icon={FileBarChart} label="Aktibong Kaso" value={assignedCases.length} accent="orange" />
        </div>
        <div className="mt-4 space-y-3">
          {assignedCases.map((r) => (
            <div key={r.id} className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400">{r.id}</p>
              <h3 className="font-bold text-gray-900">{r.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{r.hearingNote || 'Wala pang tala ng session.'}</p>
            </div>
          ))}
          {assignedCases.length === 0 && (
            <p className="text-sm text-gray-400">Walang kasalukuyang nakatalagang kaso.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Reports and Records Generation</h2>
      <p className="mt-1 text-sm text-gray-500">
        Bumuo ng periodic summaries para sa DILG/PNP accomplishment reports, i-filter ayon sa
        petsa, uri, at sektor.
      </p>

      <div className="mt-4 rounded-xl border border-gray-200 p-4 bg-white space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-500">Saklaw ng Petsa</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            >
              {DATE_RANGES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-gray-500">Uri ng Insidente</span>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            >
              {classifications.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end print:hidden">
            <button
              onClick={handleGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
            >
              <FileBarChart size={16} />
              Bumuo ng Report
            </button>
          </div>
        </div>

        {/* Custom Range Inputs */}
        {dateRange === 'Custom Range' && (
          <div className="grid grid-cols-1 gap-4 pt-4 border-t border-gray-150 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-500">Mula (Start Date)</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-500">Hanggang (End Date)</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>
          </div>
        )}
      </div>

      {generated && (
        <div className="mt-4 space-y-3 print:mt-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile icon={FileBarChart} label="Kabuuang Insidente" value={scopedIncidents.length} accent="blue" />
            <StatTile icon={FileBarChart} label="Blotter Records" value={blotterReports.length} accent="orange" />
            <StatTile icon={FileBarChart} label="Nareselba" value={statusData[2].value} accent="green" />
          </div>

          {(user.role === ROLES.SECRETARY || user.role === ROLES.CAPTAIN || user.role === ROLES.ADMIN) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MiniBarChart title="Bilang ayon sa Uri ng Insidente" data={typeData} />
              <MiniBarChart title="Status Breakdown (Under Review / Investigating / Resolved / Spam)" data={statusData} />
              <MiniBarChart title="Kabuuan ayon sa Sektor" data={sectorData} />
            </div>
          )}

          {user.role === ROLES.KAGAWAD && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <MiniBarChart title="Bilang ayon sa Uri ng Insidente (Committee View)" data={typeData} />
              <MiniBarChart title="Kabuuan ayon sa Sektor" data={sectorData} />
            </div>
          )}

          {canExport && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
              >
                <Download size={15} />
                I-export bilang Spreadsheet (CSV)
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
              >
                <Printer size={15} />
                I-export bilang PDF (Print)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
