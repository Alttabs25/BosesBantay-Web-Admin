import { Link } from 'react-router-dom'
import {
  UserCheck,
  ClipboardList,
  Gavel,
  CheckCircle2,
  MapPin,
  Clock,
  TrendingUp,
  Users,
  FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { NAV_ITEMS } from '../config/navigation'
import { ROLES, hasModuleAccess } from '../config/permissions'
import StatTile from '../components/StatTile'
import MiniBarChart from '../components/MiniBarChart'
import Pill from '../components/Pill'

const SEVERITY_COLOR = { Mataas: 'red', Katamtaman: 'orange', Mababa: 'green' }

function isToday(dateISO) {
  if (!dateISO) return false
  const d = new Date(dateISO)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { users, incidents, blotterReports, documents, auditLog } = useData()

  const pendingVerifications = users.filter((u) => u.status === 'Pending').length
  const underReview = blotterReports.filter((r) => r.status === 'Sinuri').length
  const investigating = blotterReports.filter((r) => r.status === 'Inimbestigahan').length
  const resolved = blotterReports.filter((r) => r.status === 'Nareselba').length
  const todayIncidents = incidents.filter((i) => isToday(i.dateISO)).length

  const classificationData = Object.entries(
    incidents.reduce((acc, i) => {
      acc[i.classification] = (acc[i.classification] ?? 0) + 1
      return acc
    }, {}),
  ).map(([label, value]) => ({ label, value, color: 'blue' }))

  const severityData = ['Mataas', 'Katamtaman', 'Mababa'].map((sev) => ({
    label: sev,
    value: incidents.filter((i) => i.severity === sev).length,
    color: SEVERITY_COLOR[sev],
  }))

  const registrationData = Object.entries(
    users.reduce((acc, u) => {
      const d = new Date(u.dateRegistered)
      const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  ).map(([label, value]) => ({ label, value, color: 'blue' }))

  const chatbotQueryData = [
    { label: 'Linggo 1', value: 142, color: 'blue' },
    { label: 'Linggo 2', value: 168, color: 'blue' },
    { label: 'Linggo 3', value: 121, color: 'blue' },
    { label: 'Linggo 4', value: 189, color: 'blue' },
  ]

  const activityFeed = auditLog.slice(0, 8)

  const shortcuts = NAV_ITEMS.filter(
    (item) =>
      item.module !== 'dashboard' &&
      item.module !== 'profile' &&
      hasModuleAccess(user?.role, item.module),
  )

  const isFullOverview = user?.role === ROLES.SECRETARY || user?.role === ROLES.CAPTAIN

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
      <p className="mt-1 text-sm text-gray-500">
        Buod ng kasalukuyang aktibidad ng barangay para kay {user?.role}.
      </p>

      {/* Role-scoped counters */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isFullOverview && (
          <>
            <StatTile icon={UserCheck} label="Naghihintay na Verification" value={pendingVerifications} accent="orange" />
            <StatTile icon={ClipboardList} label="Sinuri (Under Review)" value={underReview} accent="blue" />
            <StatTile icon={Gavel} label="Inimbestigahan" value={investigating} accent="orange" />
            <StatTile icon={CheckCircle2} label="Nareselba" value={resolved} accent="green" />
          </>
        )}

        {user?.role === ROLES.TANOD && (
          <>
            <StatTile icon={MapPin} label="Insidente Ngayong Araw" value={todayIncidents} accent="blue" />
            <StatTile icon={ClipboardList} label="Sinuri (Under Review)" value={underReview} accent="orange" />
          </>
        )}

        {user?.role === ROLES.LUPON && (
          <StatTile icon={Gavel} label="Nakatalagang Kaso (Investigating)" value={investigating} accent="orange" />
        )}

        {user?.role === ROLES.KAGAWAD && (
          <StatTile icon={TrendingUp} label="Kabuuang Insidente" value={incidents.length} accent="blue" />
        )}

        {user?.role === ROLES.ADMIN && (
          <>
            <StatTile icon={Users} label="Kabuuang Account" value={users.length} accent="blue" />
            <StatTile icon={UserCheck} label="Naghihintay na Verification" value={pendingVerifications} accent="orange" />
            <StatTile icon={FileText} label="Mga Dokumento" value={documents.length} accent="green" />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Analytics panel */}
        <div className="space-y-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-500">Analytics</h3>

          {isFullOverview && (
            <>
              <MiniBarChart title="Insidente ayon sa Klasipikasyon" data={classificationData} />
              <MiniBarChart title="Insidente ayon sa Kalubhaan" data={severityData} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MiniBarChart title="Paglago ng Rehistradong Residente" data={registrationData} />
                <MiniBarChart title="Chatbot Query Volume (sample)" data={chatbotQueryData} />
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500">
                  Average na turnaround mula submission hanggang resolution
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">3.5 araw</p>
              </div>
            </>
          )}

          {user?.role === ROLES.KAGAWAD && (
            <MiniBarChart title="Insidente ayon sa Klasipikasyon (Committee View)" data={classificationData} />
          )}

          {user?.role === ROLES.TANOD && (
            <MiniBarChart title="Insidente ayon sa Kalubhaan (Intake)" data={severityData} />
          )}

          {user?.role === ROLES.ADMIN && (
            <MiniBarChart title="Paglago ng Rehistradong Residente" data={registrationData} />
          )}

          {user?.role === ROLES.LUPON && (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
              Walang analytics panel para sa Lupong Tagapamayapa — puro assigned-case
              activity lamang ang nakalaan dito.
            </div>
          )}
        </div>

        {/* Activity feed + shortcuts */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-500">Live Activity Feed</h3>
            <div className="mt-2 space-y-2 rounded-xl border border-gray-200 p-3">
              {activityFeed.length === 0 && (
                <p className="p-2 text-xs text-gray-400">Wala pang aktibidad.</p>
              )}
              {activityFeed.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{entry.actorName}</p>
                    <p className="text-xs text-gray-400">{entry.actorRole}</p>
                  </div>
                  <div className="text-right">
                    <Pill color={entry.color} solid>
                      {entry.action}
                    </Pill>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400">
                      <Clock size={10} />
                      {entry.timestamp}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500">Mabilisang Access</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {shortcuts.map(({ label, path, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 p-3 text-center text-xs font-semibold text-gray-700 hover:border-bb-blue hover:bg-bb-blue-light hover:text-bb-blue transition-colors"
                >
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
