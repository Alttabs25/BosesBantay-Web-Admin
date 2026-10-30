import './Dashboard.css'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Gavel,
  MapPin,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES } from '../config/permissions'
import StatTile from '../components/StatTile'
import MiniBarChart from '../components/MiniBarChart'

const SEVERITY_COLOR = { Mataas: 'red', Katamtaman: 'orange', Mababa: 'green' }

function isToday(dateISO) {
  if (!dateISO) return false
  const date = new Date(dateISO)
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

export default function Dashboard() {
  const { user } = useAuth()
  const { users, incidents, blotterReports, documents, auditLog } = useData()

  const pendingVerifications = users.filter((account) => account.status === 'Pending').length
  const underReview = blotterReports.filter((report) => report.status === 'Sinuri').length
  const investigating = blotterReports.filter((report) => report.status === 'Inimbestigahan').length
  const resolved = blotterReports.filter((report) => report.status === 'Nareselba').length
  const todayIncidents = incidents.filter((incident) => isToday(incident.dateISO)).length

  const classificationData = Object.entries(
    incidents.reduce((counts, incident) => {
      counts[incident.classification] = (counts[incident.classification] ?? 0) + 1
      return counts
    }, {}),
  ).map(([label, value]) => ({ label, value, color: 'blue' }))

  const severityData = ['Mataas', 'Katamtaman', 'Mababa'].map((severity) => ({
    label: severity,
    value: incidents.filter((incident) => incident.severity === severity).length,
    color: SEVERITY_COLOR[severity],
  }))

  const registrationData = [
    { label: 'Aktibo (Active)', value: users.filter((account) => account.status === 'Active').length, color: 'green' },
    { label: 'Pending', value: pendingVerifications, color: 'orange' },
    { label: 'Suspended', value: users.filter((account) => account.status === 'Suspended').length, color: 'red' },
    { label: 'Deactivated', value: users.filter((account) => account.status === 'Deactivated').length, color: 'gray' },
  ]

  const chatbotQueryData = [
    { label: 'Linggo 1', value: 142, color: 'blue' },
    { label: 'Linggo 2', value: 168, color: 'blue' },
    { label: 'Linggo 3', value: 121, color: 'blue' },
    { label: 'Linggo 4', value: 189, color: 'blue' },
  ]

  const blotterData = [
    { label: 'Sinuri (Pending)', value: underReview, color: 'orange' },
    { label: 'Inimbestigahan', value: investigating, color: 'blue' },
    { label: 'Nareselba', value: resolved, color: 'green' },
    { label: 'Spam', value: blotterReports.filter((report) => report.status === 'Spam').length, color: 'red' },
  ]

  const activityFeed = auditLog.slice(0, 8)
  const isFullOverview = user?.role === ROLES.SECRETARY || user?.role === ROLES.CAPTAIN
  const hasActivityFeed = user?.role === ROLES.ADMIN

  return (
    <div className="dashboard-page">
      <section className="dashboard-metric-section" aria-label="Mahahalagang bilang">
        <div className="dashboard-section-label">
          <div><span>Priority indicators</span><p>Mga bilang na nangangailangan ng mabilis na pagtingin</p></div>
          <strong>{user?.role}</strong>
        </div>
        <div className="dashboard-metric-grid">
          {isFullOverview && <>
            <StatTile icon={UserCheck} label="Naghihintay na Verification" value={pendingVerifications} accent="orange" />
            <StatTile icon={ClipboardList} label="Sinuri (Under Review)" value={underReview} accent="blue" />
            <StatTile icon={Gavel} label="Inimbestigahan" value={investigating} accent="orange" />
            <StatTile icon={CheckCircle2} label="Nareselba" value={resolved} accent="green" />
          </>}
          {user?.role === ROLES.TANOD && <>
            <StatTile icon={MapPin} label="Insidente Ngayong Araw" value={todayIncidents} accent="blue" />
            <StatTile icon={ClipboardList} label="Sinuri (Under Review)" value={underReview} accent="orange" />
          </>}
          {user?.role === ROLES.LUPON && <StatTile icon={Gavel} label="Nakatalagang Kaso (Investigating)" value={investigating} accent="orange" />}
          {user?.role === ROLES.KAGAWAD && <StatTile icon={TrendingUp} label="Kabuuang Insidente" value={incidents.length} accent="blue" />}
          {user?.role === ROLES.ADMIN && <>
            <StatTile icon={Users} label="Kabuuang Account" value={users.length} accent="blue" />
            <StatTile icon={UserCheck} label="Naghihintay na Verification" value={pendingVerifications} accent="orange" />
            <StatTile icon={FileText} label="Mga Dokumento" value={documents.length} accent="green" />
          </>}
        </div>
      </section>

      <div className={`dashboard-workspace ${hasActivityFeed ? 'has-activity' : ''}`}>
        <section className="dashboard-panel dashboard-analytics-panel">
          <header className="dashboard-panel-heading">
            <div className="dashboard-panel-title">
              <span aria-hidden="true"><BarChart3 size={17} /></span>
              <div><h3>Analytics</h3><p>Distribution at performance ng kasalukuyang records</p></div>
            </div>
          </header>

          {isFullOverview && <div className="dashboard-chart-grid is-wide">
            <MiniBarChart title="Insidente ayon sa Klasipikasyon" data={classificationData} />
            <MiniBarChart title="Insidente ayon sa Kalubhaan" data={severityData} />
            <StatTile icon={Clock} label="Avg. turnaround (submission to resolution)" value="3.5 araw" accent="blue" />
            <MiniBarChart title="Kabuuan ng Rehistradong Residente" data={registrationData} />
            <MiniBarChart title="Kabuuan ng Blotter Reports" data={blotterData} />
            <MiniBarChart title="Chatbot Query Volume (sample)" data={chatbotQueryData} />
          </div>}

          {user?.role === ROLES.KAGAWAD && <div className="dashboard-chart-grid single"><MiniBarChart title="Insidente ayon sa Klasipikasyon (Committee View)" data={classificationData} /></div>}
          {user?.role === ROLES.TANOD && <div className="dashboard-chart-grid single"><MiniBarChart title="Insidente ayon sa Kalubhaan (Intake)" data={severityData} /></div>}
          {user?.role === ROLES.ADMIN && <div className="dashboard-chart-grid">
            <MiniBarChart title="Kabuuan ng Rehistradong Residente" data={registrationData} />
            <MiniBarChart title="Kabuuan ng Blotter Reports" data={blotterData} />
          </div>}
          {user?.role === ROLES.LUPON && <div className="dashboard-empty-panel">Walang analytics panel para sa Lupong Tagapamayapa — puro assigned-case activity lamang ang nakalaan dito.</div>}
        </section>

        {hasActivityFeed && <section className="dashboard-panel dashboard-activity-panel">
          <header className="dashboard-panel-heading">
            <div className="dashboard-panel-title">
              <span aria-hidden="true"><Activity size={17} /></span>
              <div><h3>Live Activity Feed</h3><p>Pinakabagong galaw sa Command Center</p></div>
            </div>
            <span className="dashboard-feed-count">{activityFeed.length}</span>
          </header>
          <div className="dashboard-activity-list max-h-[calc(100vh-390px)] min-h-[220px] overflow-y-auto">
            {activityFeed.length === 0 && <p className="dashboard-feed-empty">Wala pang aktibidad.</p>}
            {activityFeed.map((entry) => <article key={entry.id} className="dashboard-activity-entry">
              <span className={`dashboard-activity-marker tone-${entry.color || 'blue'}`} aria-hidden="true" />
              <div className="dashboard-activity-content">
                <div className="dashboard-activity-meta">
                  <div><strong>{entry.actorName}</strong><span>{entry.actorRole}</span></div>
                  <time><Clock size={11} />{entry.timestamp}</time>
                </div>
                <p className={`dashboard-activity-action tone-${entry.color || 'blue'}`}>{entry.action}</p>
              </div>
            </article>)}
          </div>
        </section>}
      </div>
    </div>
  )
}
