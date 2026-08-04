import { useState } from 'react'
import { Send, Clock, Trash2, Search, Filter, ShieldAlert, Bell, Info } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES } from '../config/permissions'
import Pill from '../components/Pill'
import ConfirmDialog from '../components/ConfirmDialog'

const ALERT_LEVELS = ['Normal na Pagpapayo', 'Mataas na Alerto', 'Emergency']

const LEVEL_COLOR = {
  'Normal na Pagpapayo': 'blue',
  'Mataas na Alerto': 'orange',
  Emergency: 'red',
}

const TYPE_COLOR = {
  'Governance Notice': 'blue',
  'Safety Advisory': 'orange',
  'Community Announcement': 'green',
  'Committee-scoped Advisory': 'blue',
  'System-level Broadcast': 'gray',
}

const TARGET_COLOR = {
  'Lahat ng Residente': 'green',
  'Mga Kagawad': 'blue',
  'Lupon Members': 'blue',
  'Field Patrol Tanods Lamang': 'orange',
  'Mga Kasapi ng Komite': 'blue',
  'System-wide Broadcast': 'red',
}

const CONFIGS_BY_ROLE = {
  [ROLES.SECRETARY]: {
    allowedTypes: ['Governance Notice', 'Safety Advisory', 'Community Announcement'],
    allowedTargets: ['Lahat ng Residente', 'Mga Kagawad', 'Lupon Members', 'Field Patrol Tanods Lamang'],
    canCompose: true,
  },
  [ROLES.CAPTAIN]: {
    allowedTypes: ['Governance Notice', 'Safety Advisory', 'Community Announcement'],
    allowedTargets: ['Lahat ng Residente', 'Mga Kagawad', 'Lupon Members', 'Field Patrol Tanods Lamang'],
    canCompose: true,
  },
  [ROLES.KAGAWAD]: {
    allowedTypes: ['Committee-scoped Advisory'],
    allowedTargets: ['Mga Kasapi ng Komite'],
    canCompose: true,
  },
  [ROLES.ADMIN]: {
    allowedTypes: ['System-level Broadcast'],
    allowedTargets: ['System-wide Broadcast'],
    canCompose: true,
  },
  [ROLES.TANOD]: {
    allowedTypes: [],
    allowedTargets: [],
    canCompose: false,
  },
}

export default function Alerts() {
  const { user } = useAuth()
  const { alertHistory, addAlert, deleteAlert, addAuditEntry } = useData()
  const { showToast } = useToast()

  const roleConfig = CONFIGS_BY_ROLE[user.role] || {
    allowedTypes: [],
    allowedTargets: [],
    canCompose: false,
  }

  const [title, setTitle] = useState('')
  const [noticeType, setNoticeType] = useState(roleConfig.allowedTypes[0] || '')
  const [target, setTarget] = useState(roleConfig.allowedTargets[0] || '')
  const [level, setLevel] = useState(ALERT_LEVELS[0])
  const [message, setMessage] = useState('')
  
  const [confirmingSend, setConfirmingSend] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [alertToDelete, setAlertToDelete] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterLevel, setFilterLevel] = useState('All')

  const canCompose = roleConfig.canCompose

  const requestSubmit = (e) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    setConfirmingSend(true)
  }

  const confirmSend = async () => {
    await addAlert({
      title: title.trim(),
      type: noticeType,
      target,
      level,
      message: message.trim(),
    })
    addAuditEntry(`Nagpadala ng ${noticeType} ("${title.trim()}") sa ${target}`, { color: 'blue' })
    showToast(`Naipadala ang abiso sa ${target}.`)
    setTitle('')
    setMessage('')
    setConfirmingSend(false)
  }

  const handleDeleteClick = (id) => {
    setAlertToDelete(id)
    setConfirmingDelete(true)
  }

  const confirmDelete = async () => {
    if (alertToDelete) {
      await deleteAlert(alertToDelete)
      showToast('Matagumpay na nabura ang abiso.')
      setAlertToDelete(null)
    }
    setConfirmingDelete(false)
  }

  // Filter history based on role restrictions first, then user filter controls
  const filteredHistory = alertHistory
    .filter((h) => {
      if (user.role === ROLES.ADMIN) {
        return h.type === 'System-level Broadcast'
      }
      if (user.role === ROLES.KAGAWAD) {
        return h.type === 'Committee-scoped Advisory'
      }
      return true
    })
    .filter((h) => {
      const matchSearch =
        h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.sentBy.toLowerCase().includes(searchQuery.toLowerCase())

      const matchType = filterType === 'All' || h.type === filterType
      const matchLevel = filterLevel === 'All' || h.level === filterLevel

      return matchSearch && matchType && matchLevel
    })

  // Calculations for stats
  const totalCount = filteredHistory.length
  const emergencyCount = filteredHistory.filter((h) => h.level === 'Emergency').length
  const highCount = filteredHistory.filter((h) => h.level === 'Mataas na Alerto').length

  const canDeleteAlert = user.role === ROLES.SECRETARY || user.role === ROLES.CAPTAIN || user.role === ROLES.ADMIN

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-12">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">ALERTS & NOTIFICATION TERMINAL</h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Dispatch critical security advisories, emergency alerts, governance notices, or community announcements directly to resident accounts.
        </p>
      </div>

      {/* Stats Counter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kabuuang Naipadala</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{totalCount}</p>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-lg text-blue-500">
            <Bell size={20} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mataas na Alerto</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{highCount}</p>
          </div>
          <div className="bg-orange-50 p-2.5 rounded-lg text-orange-500">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kritikal / Emergency</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{emergencyCount}</p>
          </div>
          <div className="bg-red-50 p-2.5 rounded-lg text-red-500">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className={canCompose ? "grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8" : "mx-auto max-w-4xl mt-8"}>
        {/* Left Side: Compose Form & Preview */}
        {canCompose && (
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={requestSubmit}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-300 space-y-4"
            >
              <div className="border-b border-gray-100 pb-3">
                <h3 className="text-lg font-bold text-bb-blue">
                  I-configure ang Abiso (Broadcast Setup)
                </h3>
                <p className="text-xs text-gray-500">
                  Mag-dispatch ng bagong in-app notification batay sa iyong gampanin.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Pamagat ng Abiso (Title)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="I-type ang maikling pamagat ng abiso..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </div>

              {/* Type and Target */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Uri ng Abiso (Notice Type)
                  </label>
                  <select
                    value={noticeType}
                    onChange={(e) => setNoticeType(e.target.value)}
                    disabled={roleConfig.allowedTypes.length <= 1}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue bg-white disabled:bg-gray-50 text-gray-800 font-medium"
                  >
                    {roleConfig.allowedTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Target na Residente (Target)
                  </label>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    disabled={roleConfig.allowedTargets.length <= 1}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue bg-white disabled:bg-gray-50 text-gray-800 font-medium"
                  >
                    {roleConfig.allowedTargets.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Alert Level Buttons */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Antas ng Alerto (Alert Level)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {ALERT_LEVELS.map((l) => {
                    const isSelected = level === l
                    const colorMap = {
                      'Normal na Pagpapayo': 'border-blue-500 text-blue-700 bg-blue-50/50 ring-blue-200',
                      'Mataas na Alerto': 'border-orange-500 text-orange-700 bg-orange-50/50 ring-orange-200',
                      Emergency: 'border-red-500 text-red-700 bg-red-50/50 ring-red-200',
                    }
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLevel(l)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-[11px] font-bold transition-all duration-200 ${
                          isSelected
                            ? `${colorMap[l]} ring-2`
                            : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300'
                        }`}
                      >
                        <span className={`inline-block w-2.5 h-2.5 rounded-full mb-1 ${
                          l === 'Emergency' ? 'bg-red-500' : l === 'Mataas na Alerto' ? 'bg-orange-500' : 'bg-blue-500'
                        }`} />
                        {l === 'Normal na Pagpapayo' ? 'Normal' : l === 'Mataas na Alerto' ? 'Mataas' : 'Emergency'}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Mensahe (Notice Body)
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="I-type nang malinaw ang mensahe ng opisyal na abiso..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-bb-blue py-3 font-semibold text-white hover:bg-bb-blue-dark transition-colors shadow-sm active:scale-[0.99] transition-transform duration-100"
              >
                <Send size={16} />
                Isumite at I-dispatch
              </button>
            </form>

            {/* Live Notification Preview */}
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5 justify-center">
                <span>📱 Real-time Mobile Push Preview</span>
              </h4>
              <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-md max-w-sm mx-auto">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  level === 'Emergency' ? 'bg-red-500' : level === 'Mataas na Alerto' ? 'bg-orange-500' : 'bg-blue-500'
                }`} />
                <div className="pl-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span className="font-bold text-bb-blue flex items-center gap-1 text-[11px]">
                      <Bell size={11} className="fill-bb-blue text-bb-blue" /> BOSES BANTAY
                    </span>
                    <span className="text-[10px]">now</span>
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight flex items-center gap-1.5 mb-1.5">
                    <span>{noticeType || 'Abiso'}</span>
                    <span className="text-gray-300">•</span>
                    <span className={`${
                      level === 'Emergency' ? 'text-red-500' : level === 'Mataas na Alerto' ? 'text-orange-500' : 'text-blue-500'
                    }`}>{level}</span>
                  </div>
                  <h5 className="text-sm font-bold text-gray-800 leading-tight">
                    {title ? title : 'Pamagat ng Abiso'}
                  </h5>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2 break-all">
                    {message ? message : 'Dito lalabas ang nilalaman ng mensahe kapag nag-type ka sa form sa itaas.'}
                  </p>
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] text-gray-400">
                    <span>Para sa: <span className="font-bold text-gray-600">{target}</span></span>
                    <span>Mula kay: <span className="font-bold text-gray-600">{user.name}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Side: History & Search */}
        <div className={canCompose ? "lg:col-span-7 space-y-4" : "space-y-4"}>
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Filter size={16} className="text-gray-400" />
                Mga Filter at Paghahanap
              </h3>
              {(searchQuery || filterType !== 'All' || filterLevel !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setFilterType('All')
                    setFilterLevel('All')
                  }}
                  className="text-xs text-bb-blue font-bold hover:underline"
                >
                  I-clear lahat
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative sm:col-span-1">
                <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Maghanap..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-bb-blue"
                />
              </div>

              {/* Type Filter */}
              <div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-bb-blue bg-white text-gray-700"
                >
                  <option value="All">Lahat ng Uri</option>
                  <option value="Governance Notice">Governance Notice</option>
                  <option value="Safety Advisory">Safety Advisory</option>
                  <option value="Community Announcement">Community Announcement</option>
                  <option value="Committee-scoped Advisory">Committee-scoped Advisory</option>
                  <option value="System-level Broadcast">System-level Broadcast</option>
                </select>
              </div>

              {/* Level Filter */}
              <div>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-bb-blue bg-white text-gray-700"
                >
                  <option value="All">Lahat ng Alerto</option>
                  <option value="Normal na Pagpapayo">Normal na Pagpapayo</option>
                  <option value="Mataas na Alerto">Mataas na Alerto</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
            </div>
          </div>

          {/* History Feed */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center justify-between">
              <span>Kasaysayan ng mga Alerto at Abiso</span>
              <span className="text-xs text-gray-400 font-normal">Naipakita: {filteredHistory.length}</span>
            </h3>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <Info size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-500">Walang natagpuang alerto o abiso.</p>
                <p className="text-xs text-gray-400 mt-1">Suriin ang iyong filter o mag-post ng bagong abiso.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                {filteredHistory.map((h) => (
                  <div
                    key={h.id}
                    className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 group"
                  >
                    {/* Left accent bar for alert level */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      h.level === 'Emergency' ? 'bg-red-500' : h.level === 'Mataas na Alerto' ? 'bg-orange-500' : 'bg-blue-500'
                    }`} />

                    <div className="pl-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          <Pill color={TYPE_COLOR[h.type] || 'gray'} solid={false}>
                            {h.type}
                          </Pill>
                          <Pill color={TARGET_COLOR[h.target] || 'gray'} solid={false}>
                            Para sa: {h.target}
                          </Pill>
                          <Pill color={LEVEL_COLOR[h.level] || 'gray'} solid={true}>
                            {h.level}
                          </Pill>
                        </div>

                        {/* Delete Button */}
                        {canDeleteAlert && (
                          <button
                            onClick={() => handleDeleteClick(h.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            title="Burahin ang abiso"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-bold text-gray-800 leading-tight">
                        {h.title}
                      </h4>

                      {/* Message */}
                      <p className="mt-1.5 text-xs text-gray-600 leading-relaxed break-words whitespace-pre-line">
                        {h.message}
                      </p>

                      {/* Footer Info */}
                      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock size={11} />
                          <span>{h.sentAt}</span>
                        </div>
                        <div>
                          <span>Mula kay: <span className="font-bold text-gray-500">{h.sentBy}</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Access Denied Card (Tanod read-only message) */}
      {!canCompose && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3 max-w-4xl mx-auto shadow-sm">
          <Info size={18} className="text-bb-blue mt-0.5" />
          <div className="text-xs text-gray-600">
            <span className="font-bold text-gray-800">Read-Only Access:</span> Naka-log in ka bilang <span className="font-bold">{user.role}</span>.
            Maaari mo lamang mabasa ang mga naipadalang abiso ngunit hindi ka awtorisadong gumawa at magpadala ng bago.
          </div>
        </div>
      )}

      {/* Send Confirmation Dialog */}
      <ConfirmDialog
        open={confirmingSend}
        onClose={() => setConfirmingSend(false)}
        onConfirm={confirmSend}
        title="I-dispatch ang Abiso?"
        message={`Ipapadala ang abisong "${title}" sa lahat ng napiling target (${target}). Hindi na ito mababawi kapag naipadala na. Nais mo bang magpatuloy?`}
        confirmLabel="Ipadala"
        danger={level === 'Emergency'}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={confirmDelete}
        title="Burahin ang Abiso?"
        message="Sigurado ka bang nais mong burahin ang abisong ito? Ito ay permanenteng mawawala sa talaan at hindi na makikita ng mga residenteng target nito."
        confirmLabel="Burahin"
        danger={true}
      />
    </div>
  )
}
