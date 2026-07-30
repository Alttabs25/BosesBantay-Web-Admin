import { useMemo, useState } from 'react'
import { Download, Printer, FileBarChart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES, can } from '../config/permissions'
import { ALL_CLASSIFICATIONS } from '../data/mockIncidents'
import { downloadCSV } from '../lib/csvExport'
import StatTile from '../components/StatTile'
import MiniBarChart from '../components/MiniBarChart'

const DATE_RANGES = ['Lahat ng Petsa', 'Huling 7 Araw', 'Huling 30 Araw']

function inDateRange(dateISO, range) {
  if (range === 'Lahat ng Petsa') return true
  const days = range === 'Huling 7 Araw' ? 7 : 30
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(dateISO).getTime() >= cutoff
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

  const canExport = can(user.role, 'reports', 'create')

  const classifications = useMemo(
    () => [ALL_CLASSIFICATIONS, ...new Set(incidents.map((i) => i.classification))],
    [incidents],
  )

  const [dateRange, setDateRange] = useState(DATE_RANGES[0])
  const [classification, setClassification] = useState(ALL_CLASSIFICATIONS)
  const [generated, setGenerated] = useState(false)

  const scopedIncidents = useMemo(() => {
    return incidents.filter((i) => {
      if (!inDateRange(i.dateISO, dateRange)) return false
      if (classification !== ALL_CLASSIFICATIONS && i.classification !== classification) return false
      return true
    })
  }, [incidents, dateRange, classification])

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
    setGenerated(true)
    addAuditEntry('Bumuo ng report summary', { color: 'blue' })
  }

  function handleExportCSV() {
    const rows = [
      ['Kategorya', 'Label', 'Bilang'],
      ...typeData.map((r) => ['Insidente ayon sa Klasipikasyon', r.label, r.value]),
      ...sectorData.map((r) => ['Insidente ayon sa Sektor', r.label, r.value]),
      ...statusData.map((r) => ['Blotter Status', r.label, r.value]),
    ]
    downloadCSV(`bosesbantay-report-${Date.now()}.csv`, rows)
    addAuditEntry('Nag-export ng report bilang spreadsheet (CSV)', { color: 'green' })
  }

  function handlePrint() {
    addAuditEntry('Nag-export ng report bilang PDF (print)', { color: 'green' })
    window.print()
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

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 p-4 sm:grid-cols-3">
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
        <div className="flex items-end">
          <button
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-bb-blue py-2.5 text-sm font-semibold text-white hover:bg-bb-blue-dark transition-colors"
          >
            <FileBarChart size={16} />
            Bumuo ng Report
          </button>
        </div>
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
                className="flex items-center gap-2 rounded-full bg-bb-navy px-4 py-2 text-sm font-semibold text-white hover:bg-bb-blue-dark"
              >
                <Download size={15} />
                I-export bilang Spreadsheet (CSV)
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
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
