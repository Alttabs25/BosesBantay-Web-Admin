import './Reports.css'
import { useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Download, FileBarChart, FileSpreadsheet, Printer, SlidersHorizontal } from 'lucide-react'
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
  if (range === 'Huling 7 Araw') return new Date(dateISO).getTime() >= Date.now() - 7 * 86400000
  if (range === 'Huling 30 Araw') return new Date(dateISO).getTime() >= Date.now() - 30 * 86400000
  if (range === 'Custom Range') {
    if (!dateISO) return false
    const time = new Date(dateISO).getTime()
    const start = customStart ? new Date(`${customStart}T00:00:00`).getTime() : 0
    const end = customEnd ? new Date(`${customEnd}T23:59:59`).getTime() : Infinity
    return time >= start && time <= end
  }
  return true
}

function countBy(items, keyFn) {
  const counts = items.reduce((result, item) => {
    const key = keyFn(item) || 'Hindi Tinukoy'
    result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
  return Object.entries(counts).map(([label, value]) => ({ label, value, color: 'blue' }))
}

export default function Reports() {
  const { user } = useAuth()
  const { incidents, blotterReports, addAuditEntry } = useData()
  const { showToast } = useToast()
  const canExport = can(user.role, 'reports', 'create')
  const classifications = useMemo(() => [ALL_CLASSIFICATIONS, ...new Set(incidents.map((incident) => incident.classification))], [incidents])
  const [dateRange, setDateRange] = useState(DATE_RANGES[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [classification, setClassification] = useState(ALL_CLASSIFICATIONS)
  const [generated, setGenerated] = useState(false)

  const scopedIncidents = useMemo(() => incidents.filter((incident) => inDateRange(incident.dateISO, dateRange, startDate, endDate) && (classification === ALL_CLASSIFICATIONS || incident.classification === classification)), [incidents, dateRange, classification, startDate, endDate])
  const typeData = useMemo(() => countBy(scopedIncidents, (incident) => incident.classification), [scopedIncidents])
  const sectorData = useMemo(() => countBy(scopedIncidents, (incident) => incident.sector), [scopedIncidents])
  const statusData = useMemo(() => [
    { label: 'Sinuri', value: blotterReports.filter((report) => report.status === 'Sinuri').length, color: 'orange' },
    { label: 'Inimbestigahan', value: blotterReports.filter((report) => report.status === 'Inimbestigahan').length, color: 'blue' },
    { label: 'Nareselba', value: blotterReports.filter((report) => report.status === 'Nareselba').length, color: 'green' },
    { label: 'Spam', value: blotterReports.filter((report) => report.status === 'Spam').length, color: 'red' },
  ], [blotterReports])
  const assignedCases = useMemo(() => blotterReports.filter((report) => report.status === 'Inimbestigahan'), [blotterReports])

  function handleGenerate() {
    if (dateRange === 'Custom Range' && (!startDate || !endDate)) {
      showToast('Mangyaring piliin ang parehong Start at End Date para sa Custom Range.', 'error')
      return
    }
    setGenerated(true)
    addAuditEntry('Bumuo ng report summary', { color: 'blue' })
  }

  function handleExportCSV() {
    const rows = [['Kategorya', 'Label', 'Bilang'], ...typeData.map((row) => ['Insidente ayon sa Uri ng Insidente', row.label, row.value]), ...sectorData.map((row) => ['Kabuuan ayon sa Sektor', row.label, row.value]), ...statusData.map((row) => ['Status Breakdown', row.label, row.value])]
    downloadCSV(`bosesbantay-report-${Date.now()}.csv`, rows)
    showToast('Nai-download na ang Spreadsheet (CSV) report summary.', 'success')
    addAuditEntry('Nag-export ng report bilang spreadsheet (CSV)', { color: 'green' })
  }

  function handlePrint() {
    addAuditEntry('Nag-export ng report bilang PDF (print)', { color: 'green' })
    setTimeout(() => { window.print(); showToast('Nai-export na ang PDF report summary.', 'success') }, 150)
  }

  if (user.role === ROLES.LUPON) return <div className="reports-page">
    <section className="assigned-case-summary"><header><span><FileBarChart size={20} /></span><div><p>Assigned case report</p><h2>Buod ng Nakatalagang Kaso</h2><small>Mga kasong kasalukuyang nasa investigation.</small></div><strong>{assignedCases.length}</strong></header>
      <div className="assigned-case-list">{assignedCases.map((report) => <article key={report.id}><div><span>{report.id}</span><h3>{report.title}</h3><p>{report.hearingNote || 'Wala pang tala ng session.'}</p></div><em>Investigating</em></article>)}{!assignedCases.length && <div className="reports-empty-state">Walang kasalukuyang nakatalagang kaso.</div>}</div>
    </section>
  </div>

  const scopeLabel = dateRange === 'Custom Range' ? `${startDate} hanggang ${endDate}` : dateRange
  const canViewFullAnalytics = [ROLES.SECRETARY, ROLES.CAPTAIN, ROLES.ADMIN].includes(user.role)

  return <div className="reports-page">
    <section className="report-builder-panel print:hidden">
      <header className="report-builder-heading"><span><SlidersHorizontal size={20} /></span><div><p>Report configuration</p><h2>Bumuo ng Records Summary</h2><small>Piliin ang saklaw bago i-generate ang opisyal na buod.</small></div></header>
      <div className="report-builder-body">
        <label><span><CalendarDays size={14} /> Saklaw ng petsa</span><select value={dateRange} onChange={(event) => { setDateRange(event.target.value); setGenerated(false) }}>{DATE_RANGES.map((range) => <option key={range}>{range}</option>)}</select></label>
        <label><span><BarChart3 size={14} /> Uri ng insidente</span><select value={classification} onChange={(event) => { setClassification(event.target.value); setGenerated(false) }}>{classifications.map((item) => <option key={item}>{item}</option>)}</select></label>
        {dateRange === 'Custom Range' && <div className="report-custom-dates"><label><span>Mula</span><input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setGenerated(false) }} /></label><label><span>Hanggang</span><input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setGenerated(false) }} /></label></div>}
        <button type="button" onClick={handleGenerate} className="report-generate-button"><FileBarChart size={17} /> Bumuo ng Report</button>
      </div>
    </section>

    {!generated && <section className="report-ready-state print:hidden"><FileSpreadsheet size={28} /><h3>Handa nang bumuo ng report</h3><p>I-set ang petsa at uri ng insidente, pagkatapos piliin ang “Bumuo ng Report”.</p></section>}

    {generated && <section className="report-output-panel">
      <header className="report-output-heading"><div><p>Generated records summary</p><h2>Barangay Incident Report</h2><dl><div><dt>Saklaw</dt><dd>{scopeLabel}</dd></div><div><dt>Klasipikasyon</dt><dd>{classification}</dd></div><div><dt>Inihanda para sa</dt><dd>{user.role}</dd></div></dl></div>
        {canExport && <div className="report-export-actions print:hidden"><button type="button" onClick={handleExportCSV}><Download size={16} /> Spreadsheet (CSV)</button><button type="button" onClick={handlePrint}><Printer size={16} /> PDF / Print</button></div>}
      </header>

      <div className="report-output-body">
        <section className="report-kpi-grid" aria-label="Report summary"><StatTile icon={FileBarChart} label="Kabuuang Insidente" value={scopedIncidents.length} accent="blue" /><StatTile icon={FileBarChart} label="Blotter Records" value={blotterReports.length} accent="orange" /><StatTile icon={FileBarChart} label="Nareselba" value={statusData[2].value} accent="green" /></section>
        <section className={`report-analytics-grid ${canViewFullAnalytics ? 'is-three-column' : ''}`}>
          <MiniBarChart title={user.role === ROLES.KAGAWAD ? 'Insidente ayon sa Uri (Committee View)' : 'Insidente ayon sa Uri'} data={typeData} />
          {canViewFullAnalytics && <MiniBarChart title="Status ng Blotter Records" data={statusData} />}
          <MiniBarChart title="Kabuuan ayon sa Sektor" data={sectorData} />
        </section>
      </div>
    </section>}
  </div>
}
