import { useState } from 'react'
import { Send, Clock } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES, can } from '../config/permissions'
import Pill from '../components/Pill'

const TARGETS = [
  'Field Patrol Tanods Lamang',
  'Lahat ng Residente',
  'Mga Kagawad',
  'Lupon Members',
]

const TARGETS_BY_ROLE = {
  [ROLES.SECRETARY]: TARGETS,
  [ROLES.CAPTAIN]: TARGETS,
  [ROLES.KAGAWAD]: ['Kagawad Committee Lamang'],
  [ROLES.ADMIN]: ['System-wide Advisory (Admin)'],
}

const ALERT_LEVELS = ['Normal na Pagpapayo', 'Mataas na Alerto', 'Emergency']

const LEVEL_COLOR = {
  'Normal na Pagpapayo': 'blue',
  'Mataas na Alerto': 'orange',
  Emergency: 'red',
}

export default function Alerts() {
  const { user } = useAuth()
  const { alertHistory, addAlert, addAuditEntry } = useData()
  const { showToast } = useToast()

  const canCompose = can(user.role, 'alerts', 'create')
  const availableTargets = TARGETS_BY_ROLE[user.role] ?? TARGETS

  const [target, setTarget] = useState(availableTargets[0])
  const [level, setLevel] = useState(ALERT_LEVELS[0])
  const [message, setMessage] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!message.trim()) return

    addAlert({
      id: Date.now(),
      target,
      level,
      message: message.trim(),
      sentBy: user.name,
      sentAt: new Date().toLocaleString('en-PH', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    })
    addAuditEntry(`Nagpadala ng alerto sa ${target}`, { color: 'blue' })
    showToast(`Naipadala ang alerto sa ${target}.`)
    setMessage('')
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">ALERTS TERMINAL</h2>
      <p className="mt-1 text-sm text-gray-500">
        Dispatch critical security advisories, emergency alerts, or
        administrative notices to registered resident profiles instantly.
      </p>

      {canCompose ? (
        <form
          onSubmit={handleSubmit}
          className="mt-4 max-w-3xl space-y-5 rounded-xl border border-gray-200 p-6"
        >
          <h3 className="font-semibold text-bb-blue">
            Dispatch Live Push Notification Broadcast
          </h3>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Broadcasting Target
              </span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {availableTargets.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Advisory Alert Level
              </span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {ALERT_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Klase ng Klasipikasyon
            </span>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="i-type nang malinaw ang opisyal na mensahe ng alerto"
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-bb-blue py-3 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
          >
            <Send size={16} />
            Isumite
          </button>
        </form>
      ) : (
        <div className="mt-4 max-w-3xl rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          Read-only access — hindi maaaring mag-compose ng bagong alerto ang{' '}
          {user.role}. Makikita sa ibaba ang mga naipadalang abiso.
        </div>
      )}

      <div className="mt-6 max-w-3xl">
        <h3 className="text-sm font-semibold text-gray-500">
          Kasaysayan ng mga Alerto ({alertHistory.length})
        </h3>
        {alertHistory.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Wala pang naipadalang alerto.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {alertHistory.map((h) => (
              <div key={h.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">{h.target}</span>
                  <Pill color={LEVEL_COLOR[h.level] ?? 'gray'} solid>
                    {h.level}
                  </Pill>
                </div>
                <p className="mt-1.5 text-sm text-gray-600">{h.message}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock size={12} />
                  {h.sentAt} — {h.sentBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
