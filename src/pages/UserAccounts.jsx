import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  Check,
  X as XIcon,
} from 'lucide-react'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES, ROLES_REQUIRING_PB_APPROVAL } from '../config/permissions'

const STATUS_COLOR = {
  Active: 'green',
  Pending: 'orange',
  Suspended: 'red',
  Deactivated: 'gray',
}

const ACTION_BY_STATUS = {
  Pending: { label: 'Approve', next: 'Active', className: 'bg-green-600 hover:bg-green-700' },
  Active: { label: 'Suspend', next: 'Suspended', className: 'bg-orange-500 hover:bg-orange-600' },
  Suspended: { label: 'Deactivate', next: 'Deactivated', className: 'bg-red-600 hover:bg-red-700' },
}

const TOAST_BY_NEXT_STATUS = {
  Active: 'Na-approve ang account.',
  Suspended: 'Na-suspend ang account.',
  Deactivated: 'Na-deactivate ang account.',
}

const ASSIGNABLE_ROLES = [
  'Residente',
  ROLES.SECRETARY,
  ROLES.TANOD,
  ROLES.LUPON,
  ROLES.KAGAWAD,
  ROLES.CAPTAIN,
]

const BLANK_NEW_ACCOUNT = { name: '', email: '', phone: '', address: '' }

function nextUserId(users) {
  const max = users.reduce((acc, u) => {
    const n = parseInt(u.id.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `USR - ${String(max + 1).padStart(5, '0')}`
}

export default function UserAccounts() {
  const { user } = useAuth()
  const { users, updateUser, addUser, removeUser, addAuditEntry } = useData()
  const { showToast } = useToast()

  const isAdmin = user.role === ROLES.ADMIN
  const isCaptain = user.role === ROLES.CAPTAIN

  const [query, setQuery] = useState('')
  const [viewingId, setViewingId] = useState(null)
  const [roleChoice, setRoleChoice] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccount, setNewAccount] = useState(BLANK_NEW_ACCOUNT)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
  }, [users, query])

  const pendingRequests = useMemo(() => users.filter((u) => u.pendingRoleRequest), [users])

  const viewingUser = users.find((u) => u.id === viewingId) ?? null

  function applyAction(id) {
    const target = users.find((u) => u.id === id)
    const action = target && ACTION_BY_STATUS[target.status]
    if (!action) return
    updateUser(id, { status: action.next })
    const colorByNext = { Active: 'green', Suspended: 'orange', Deactivated: 'red' }
    addAuditEntry(`${action.label} User ID ${target.id}`, { color: colorByNext[action.next] })
    showToast(TOAST_BY_NEXT_STATUS[action.next] ?? 'Na-update ang account.')
  }

  function openProfile(id) {
    setViewingId(id)
    setRoleChoice('')
  }

  function assignRole(targetUser) {
    if (!roleChoice || roleChoice === targetUser.role) return
    if (ROLES_REQUIRING_PB_APPROVAL.includes(roleChoice)) {
      updateUser(targetUser.id, {
        pendingRoleRequest: {
          requestedRole: roleChoice,
          requestedBy: user.name,
          requestedAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        },
      })
      addAuditEntry(`Humiling ng tungkuling ${roleChoice} para kay ${targetUser.name}`, { color: 'orange' })
      showToast(`Naisumite ang kahilingan na gawing ${roleChoice} si ${targetUser.name} — naghihintay ng PB approval.`)
    } else {
      updateUser(targetUser.id, { role: roleChoice, status: 'Active' })
      addAuditEntry(`Nag-assign ng tungkuling ${roleChoice} kay ${targetUser.name}`, { color: 'blue' })
      showToast(`Na-assign si ${targetUser.name} bilang ${roleChoice}.`)
    }
    setRoleChoice('')
    setViewingId(null)
  }

  function approveRequest(targetUser) {
    const requestedRole = targetUser.pendingRoleRequest.requestedRole
    updateUser(targetUser.id, {
      role: requestedRole,
      status: 'Active',
      pendingRoleRequest: null,
    })
    addAuditEntry(`Inaprubahan ang tungkuling ${requestedRole} para kay ${targetUser.name}`, { color: 'green' })
    showToast(`Na-approve: si ${targetUser.name} ngayon ay ${requestedRole}.`)
  }

  function rejectRequest(targetUser) {
    updateUser(targetUser.id, { pendingRoleRequest: null })
    addAuditEntry(`Tinanggihan ang kahilingan sa tungkulin ni ${targetUser.name}`, { color: 'red' })
    showToast(`Tinanggihan ang kahilingan para kay ${targetUser.name}.`, 'error')
  }

  function confirmDelete() {
    const target = users.find((u) => u.id === pendingDeleteId)
    removeUser(pendingDeleteId)
    addAuditEntry(`Tinanggal ang account ni ${target?.name ?? pendingDeleteId}`, { color: 'red' })
    showToast(`Tinanggal ang account ni ${target?.name ?? ''}.`)
  }

  function submitNewAccount(e) {
    e.preventDefault()
    if (!newAccount.name.trim() || !newAccount.email.trim()) {
      showToast('Kumpletuhin ang pangalan at email.', 'error')
      return
    }
    addUser({
      id: nextUserId(users),
      name: newAccount.name.trim(),
      role: 'Residente',
      verified: 'Verified',
      status: 'Active',
      email: newAccount.email.trim(),
      phone: newAccount.phone.trim(),
      address: newAccount.address.trim(),
      dateRegistered: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      pendingRoleRequest: null,
    })
    addAuditEntry(`Nagdagdag ng bagong account: ${newAccount.name.trim()}`, { color: 'green' })
    showToast(`Naidagdag ang account ni ${newAccount.name.trim()}.`)
    setNewAccount(BLANK_NEW_ACCOUNT)
    setAddingAccount(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Mga Account ng User</h2>
          <p className="mt-1 text-sm text-gray-500">
            Review, validate, and update User Accounts.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setAddingAccount(true)}
            className="flex items-center gap-1.5 rounded-full bg-bb-blue px-4 py-2 text-sm font-semibold text-white hover:bg-bb-blue-dark transition-colors"
          >
            <Plus size={16} />
            Magdagdag ng Account
          </button>
        )}
      </div>

      {isCaptain && pendingRequests.length > 0 && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <h3 className="text-sm font-semibold text-orange-700">
            Mga Kahilingan sa Tungkulin ({pendingRequests.length})
          </h3>
          <div className="mt-2 space-y-2">
            {pendingRequests.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {u.name} → {u.pendingRoleRequest.requestedRole}
                  </p>
                  <p className="text-xs text-gray-400">
                    Hiniling ni {u.pendingRoleRequest.requestedBy} — {u.pendingRoleRequest.requestedAt}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveRequest(u)}
                    className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    <Check size={12} />
                    Aprubahan
                  </button>
                  <button
                    onClick={() => rejectRequest(u)}
                    className="flex items-center gap-1 rounded-full bg-gray-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-500"
                  >
                    <XIcon size={12} />
                    Tanggihan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 max-w-md">
        <SearchInput value={query} onChange={setQuery} placeholder="Hanapin ang User..." />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">User ID</th>
              <th className="px-4 py-3 font-semibold">Pangalan</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Verified</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Aksyon</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const action = ACTION_BY_STATUS[u.status]
              return (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-700">{u.id}</td>
                  <td className="px-4 py-3 text-gray-700">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.role}
                    {u.pendingRoleRequest && (
                      <span className="ml-1 text-xs text-orange-500">
                        (→ {u.pendingRoleRequest.requestedRole} pending)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.verified === 'Verified' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-green-600">
                        <CheckCircle2 size={15} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-orange-500">
                        <AlertCircle size={15} /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill color={STATUS_COLOR[u.status] ?? 'gray'} solid>
                      {u.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => openProfile(u.id)}
                        className="rounded-full bg-bb-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-bb-blue-dark"
                      >
                        View full Profile
                      </button>
                      {isAdmin && action && (
                        <button
                          onClick={() => applyAction(u.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white ${action.className}`}
                        >
                          {action.label}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setPendingDeleteId(u.id)}
                          className="flex items-center gap-1 rounded-full bg-gray-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  Walang nahanap na user.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewingUser} onClose={() => setViewingId(null)} title="Buong Profile ng User">
        {viewingUser && (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-gray-900">{viewingUser.name}</h4>
                <p className="text-sm text-gray-500">
                  {viewingUser.id} &middot; {viewingUser.role}
                </p>
              </div>
              <Pill color={STATUS_COLOR[viewingUser.status] ?? 'gray'} solid>
                {viewingUser.status}
              </Pill>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-sm font-medium">
              {viewingUser.verified === 'Verified' ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <CheckCircle2 size={15} /> Verified na account
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-orange-500">
                  <AlertCircle size={15} /> Naghihintay ng verification
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2.5 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="shrink-0 text-gray-400" />
                {viewingUser.email}
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="shrink-0 text-gray-400" />
                {viewingUser.phone}
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin size={15} className="shrink-0 text-gray-400" />
                {viewingUser.address}
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar size={15} className="shrink-0 text-gray-400" />
                Nagparehistro noong {viewingUser.dateRegistered}
              </div>
            </div>

            {isAdmin && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <h5 className="text-sm font-semibold text-gray-700">Baguhin ang Tungkulin</h5>
                {viewingUser.pendingRoleRequest ? (
                  <p className="mt-2 text-xs text-orange-500">
                    May nakabinbing kahilingan patungong {viewingUser.pendingRoleRequest.requestedRole}.
                  </p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <select
                      value={roleChoice}
                      onChange={(e) => setRoleChoice(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                    >
                      <option value="">Pumili ng bagong tungkulin...</option>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignRole(viewingUser)}
                      className="shrink-0 rounded-lg bg-bb-navy px-4 py-2 text-sm font-semibold text-white hover:bg-bb-blue-dark"
                    >
                      I-assign
                    </button>
                  </div>
                )}
              </div>
            )}

            {isAdmin && ACTION_BY_STATUS[viewingUser.status] && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    applyAction(viewingUser.id)
                    setViewingId(null)
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${ACTION_BY_STATUS[viewingUser.status].className}`}
                >
                  {ACTION_BY_STATUS[viewingUser.status].label}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={addingAccount} onClose={() => setAddingAccount(false)} title="Magdagdag ng Account">
        <form onSubmit={submitNewAccount} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Buong Pangalan</span>
            <input
              type="text"
              required
              value={newAccount.name}
              onChange={(e) => setNewAccount((a) => ({ ...a, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Email</span>
            <input
              type="email"
              required
              value={newAccount.email}
              onChange={(e) => setNewAccount((a) => ({ ...a, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Numero ng Telepono</span>
            <input
              type="text"
              value={newAccount.phone}
              onChange={(e) => setNewAccount((a) => ({ ...a, phone: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Address</span>
            <input
              type="text"
              value={newAccount.address}
              onChange={(e) => setNewAccount((a) => ({ ...a, address: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-bb-blue py-2.5 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
          >
            Isumite
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId != null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        title="Tanggalin ang Account"
        message="Sigurado ka bang gusto mong tanggalin ang account na ito? Hindi na ito maibabalik."
        confirmLabel="Tanggalin"
      />
    </div>
  )
}
