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
  ShieldCheck,
  KeyRound,
  Dices,
  SlidersHorizontal,
  Copy,
} from 'lucide-react'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import {
  ROLES,
  ROLES_REQUIRING_PB_APPROVAL,
  ASSIGNABLE_MODULES,
  ASSIGNABLE_MODULE_ROLES,
} from '../config/permissions'

const PORTAL_ROLES = [
  ROLES.SECRETARY,
  ROLES.TANOD,
  ROLES.LUPON,
  ROLES.KAGAWAD,
  ROLES.CAPTAIN,
  ROLES.ADMIN,
]

const BLANK_ADMIN_ACCOUNT = { name: '', email: '', role: PORTAL_ROLES[0], tempPassword: '' }

function generateTempPassword() {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `Barangay#${digits}`
}

const STATUS_COLOR = {
  Active: 'green',
  Pending: 'orange',
  Suspended: 'red',
  Deactivated: 'gray',
}

const ACTION_BY_STATUS = {
  Pending: {
    label: 'Approve',
    next: 'Active',
    className: 'bg-green-600 hover:bg-green-700',
    toast: 'Na-approve ang account.',
    confirmTitle: 'Aprubahan ang Account',
    confirmMessage: (name) => `Sigurado ka bang gusto mong aprubahan ang account ni ${name}? Magiging Active ito.`,
    danger: false,
  },
  Active: {
    label: 'Suspend',
    next: 'Suspended',
    className: 'bg-orange-500 hover:bg-orange-600',
    toast: 'Na-suspend ang account.',
    confirmTitle: 'I-suspend ang Account',
    confirmMessage: (name) => `Sigurado ka bang gusto mong i-suspend ang account ni ${name}?`,
    danger: true,
  },
  Suspended: {
    label: 'Deactivate',
    next: 'Deactivated',
    className: 'bg-red-600 hover:bg-red-700',
    toast: 'Na-deactivate ang account.',
    confirmTitle: 'I-deactivate ang Account',
    confirmMessage: (name) => `Sigurado ka bang gusto mong i-deactivate ang account ni ${name}? Mawawalan sila ng access.`,
    danger: true,
  },
  Deactivated: {
    label: 'I-reactivate',
    next: 'Active',
    className: 'bg-blue-600 hover:bg-blue-700',
    toast: 'Na-reactivate ang account. Aktibo na muli ito.',
    confirmTitle: 'I-reactivate ang Account',
    confirmMessage: (name) => `Sigurado ka bang gusto mong i-reactivate ang account ni ${name}?`,
    danger: false,
  },
}

const ASSIGNABLE_ROLES = [
  'Residente',
  ROLES.SECRETARY,
  ROLES.TANOD,
  ROLES.LUPON,
  ROLES.KAGAWAD,
  ROLES.CAPTAIN,
]

const BLANK_NEW_ACCOUNT = { first_name: '', last_name: '', address: '', email: '', password: '' }

function nextUserId(users) {
  const max = users.reduce((acc, u) => {
    const n = parseInt(u.id.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `USR - ${String(max + 1).padStart(5, '0')}`
}

function maskId(id) {
  if (!id) return ''
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

export default function UserAccounts() {
  const { user, accounts, createAdminAccount, createResidentAccount, resetAdminAccountPassword, deleteAdminAccount } = useAuth()
  const { users, updateUser, addUser, removeUser, addAuditEntry, roleModuleAccess, setModuleAccess, fetchData } = useData()
  const { showToast } = useToast()

  const [copiedId, setCopiedId] = useState(null)

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const isAdmin = user.role === ROLES.ADMIN
  const isCaptain = user.role === ROLES.CAPTAIN

  const [activeTab, setActiveTab] = useState('residents') // 'residents' | 'admin' | 'modules'
  const [addingAdminAccount, setAddingAdminAccount] = useState(false)
  const [newAdminAccount, setNewAdminAccount] = useState(BLANK_ADMIN_ACCOUNT)
  const [pendingResetId, setPendingResetId] = useState(null)
  const [pendingAdminDeleteId, setPendingAdminDeleteId] = useState(null)
  const [pendingModuleToggle, setPendingModuleToggle] = useState(null)
  const [pendingStatusActionId, setPendingStatusActionId] = useState(null)
  const [pendingRoleAssignment, setPendingRoleAssignment] = useState(null)
  const [pendingRoleDecision, setPendingRoleDecision] = useState(null)

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
  const pendingStatusUser = users.find((u) => u.id === pendingStatusActionId) ?? null
  const pendingStatusActionMeta = pendingStatusUser ? ACTION_BY_STATUS[pendingStatusUser.status] : null

  function applyAction(id) {
    const target = users.find((u) => u.id === id)
    const action = target && ACTION_BY_STATUS[target.status]
    if (!action) return
    updateUser(id, { status: action.next })
    const colorByNext = { Active: 'green', Suspended: 'orange', Deactivated: 'red' }
    addAuditEntry(`${action.label} User ID ${target.id}`, { color: colorByNext[action.next] })
    showToast(action.toast ?? 'Na-update ang account.')
  }

  function confirmStatusAction() {
    if (!pendingStatusActionId) return
    applyAction(pendingStatusActionId)
    setPendingStatusActionId(null)
    setViewingId(null)
  }

  function openProfile(id) {
    setViewingId(id)
    setRoleChoice('')
  }

  function requestRoleAssignment(targetUser) {
    if (!roleChoice || roleChoice === targetUser.role) return
    setPendingRoleAssignment({ targetUser, role: roleChoice })
  }

  function confirmRoleAssignment() {
    if (!pendingRoleAssignment) return
    const { targetUser, role } = pendingRoleAssignment
    if (ROLES_REQUIRING_PB_APPROVAL.includes(role)) {
      updateUser(targetUser.id, {
        pendingRoleRequest: {
          requestedRole: role,
          requestedBy: user.name,
          requestedAt: new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        },
      })
      addAuditEntry(`Humiling ng tungkuling ${role} para kay ${targetUser.name}`, { color: 'orange' })
      showToast(`Naisumite ang kahilingan na gawing ${role} si ${targetUser.name} — naghihintay ng PB approval.`)
    } else {
      updateUser(targetUser.id, { role, status: 'Active' })
      addAuditEntry(`Nag-assign ng tungkuling ${role} kay ${targetUser.name}`, { color: 'blue' })
      showToast(`Na-assign si ${targetUser.name} bilang ${role}.`)
    }
    setRoleChoice('')
    setViewingId(null)
    setPendingRoleAssignment(null)
  }

  function requestRoleDecision(targetUser, decision) {
    setPendingRoleDecision({ targetUser, decision })
  }

  function confirmRoleDecision() {
    if (!pendingRoleDecision) return
    const { targetUser, decision } = pendingRoleDecision
    if (decision === 'approve') {
      const requestedRole = targetUser.pendingRoleRequest.requestedRole
      updateUser(targetUser.id, {
        role: requestedRole,
        status: 'Active',
        pendingRoleRequest: null,
      })
      addAuditEntry(`Inaprubahan ang tungkuling ${requestedRole} para kay ${targetUser.name}`, { color: 'green' })
      showToast(`Na-approve: si ${targetUser.name} ngayon ay ${requestedRole}.`)
    } else {
      updateUser(targetUser.id, { pendingRoleRequest: null })
      addAuditEntry(`Tinanggihan ang kahilingan sa tungkulin ni ${targetUser.name}`, { color: 'red' })
      showToast(`Tinanggihan ang kahilingan para kay ${targetUser.name}.`, 'error')
    }
    setPendingRoleDecision(null)
  }

  function confirmDelete() {
    const target = users.find((u) => u.id === pendingDeleteId)
    removeUser(pendingDeleteId)
    addAuditEntry(`Tinanggal ang account ni ${target?.name ?? pendingDeleteId}`, { color: 'red' })
    showToast(`Tinanggal ang account ni ${target?.name ?? ''}.`)
  }

  async function submitNewAccount(e) {
    e.preventDefault()
    if (
      !newAccount.first_name.trim() ||
      !newAccount.last_name.trim() ||
      !newAccount.email.trim() ||
      !newAccount.password.trim()
    ) {
      showToast('Kumpletuhin ang lahat ng kailangang field.', 'error')
      return
    }
    const res = await createResidentAccount({
      first_name: newAccount.first_name,
      last_name: newAccount.last_name,
      address: newAccount.address,
      email: newAccount.email,
      password: newAccount.password,
    })
    if (!res.success) {
      showToast(res.error || 'May error sa paglikha ng account.', 'error')
      return
    }
    addAuditEntry(`Nagdagdag ng bagong resident account: ${newAccount.first_name} ${newAccount.last_name}`, { color: 'green' })
    showToast(`Naidagdag ang account ni ${newAccount.first_name} ${newAccount.last_name}. Naghihintay ng pag-apruba.`)
    fetchData()
    setNewAccount(BLANK_NEW_ACCOUNT)
    setAddingAccount(false)
  }

  async function submitNewAdminAccount(e) {
    e.preventDefault()
    if (!newAdminAccount.name.trim() || !newAdminAccount.email.trim() || !newAdminAccount.tempPassword.trim()) {
      showToast('Kumpletuhin ang pangalan, email, at pansamantalang password.', 'error')
      return
    }
    const result = await createAdminAccount({
      name: newAdminAccount.name,
      email: newAdminAccount.email,
      role: newAdminAccount.role,
      tempPassword: newAdminAccount.tempPassword.trim(),
    })
    if (!result.success) {
      showToast(result.error || 'May account na gumagamit ng email na iyan.', 'error')
      return
    }
    addAuditEntry(
      `Gumawa ng bagong admin portal account para kay ${newAdminAccount.name.trim()} (${newAdminAccount.role})`,
      { color: 'green' },
    )
    showToast(`Nagawa ang admin account ni ${newAdminAccount.name.trim()}. Kailangan niyang baguhin ang password sa unang login.`)
    setNewAdminAccount(BLANK_ADMIN_ACCOUNT)
    setAddingAdminAccount(false)
  }

  async function confirmResetAdminPassword() {
    const account = accounts.find((a) => a.id === pendingResetId)
    if (!account) return
    const tempPassword = generateTempPassword()
    await resetAdminAccountPassword(account.id, tempPassword)
    addAuditEntry(`Nag-reset ng password para sa admin account ni ${account.name}`, { color: 'orange' })
    showToast(`Bagong pansamantalang password para kay ${account.name}: ${tempPassword}`)
  }

  async function confirmDeleteAdminAccount() {
    const account = accounts.find((a) => a.id === pendingAdminDeleteId)
    if (!account) return
    await deleteAdminAccount(account.id)
    addAuditEntry(`Tinanggal ang admin portal account ni ${account.name}`, { color: 'red' })
    showToast(`Tinanggal ang admin account ni ${account.name}.`)
  }

  function requestModuleToggle(role, moduleKey, moduleLabel, enabled) {
    setPendingModuleToggle({ role, moduleKey, moduleLabel, enabled })
  }

  function confirmModuleToggle() {
    if (!pendingModuleToggle) return
    const { role, moduleKey, moduleLabel, enabled } = pendingModuleToggle
    setModuleAccess(role, moduleKey, enabled)
    addAuditEntry(
      `Binago ang access sa module na "${moduleLabel}" para sa ${role}: ${enabled ? 'Naka-on' : 'Naka-off'}`,
      { color: enabled ? 'green' : 'orange' },
    )
    showToast(
      enabled
        ? `Na-on ang "${moduleLabel}" para sa ${role}.`
        : `Na-off ang "${moduleLabel}" para sa ${role}.`,
    )
  }

  const showResidents = !isAdmin || activeTab === 'residents'
  const showAdminAccounts = isAdmin && activeTab === 'admin'
  const showModuleAccess = isAdmin && activeTab === 'modules'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {showAdminAccounts
              ? 'Mga Admin Portal Account'
              : showModuleAccess
                ? 'Pamamahagi ng Access sa Module'
                : 'Mga Account ng User'}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {showAdminAccounts
              ? 'Mga account na maaaring mag-login sa Command Center na ito.'
              : showModuleAccess
                ? 'Piliin kung aling mga module ang makikita at ma-a-access ng bawat tungkulin (role).'
                : 'Review, validate, and update User Accounts.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex rounded-lg border border-gray-200 bg-gray-50/50 p-0.5 shadow-xs">
              <button
                onClick={() => setActiveTab('residents')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  activeTab === 'residents'
                    ? 'bg-bb-blue text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                Mga Residente
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  activeTab === 'admin'
                    ? 'bg-bb-blue text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                Admin Portal
              </button>
              <button
                onClick={() => setActiveTab('modules')}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  activeTab === 'modules'
                    ? 'bg-bb-blue text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                Module Access
              </button>
            </div>
          )}
          {isAdmin && activeTab === 'residents' && (
            <button
              onClick={() => setAddingAccount(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-4 py-2 text-sm font-semibold text-white transition-all active:scale-[0.98]"
            >
              <Plus size={16} />
              Magdagdag ng Account
            </button>
          )}
          {showAdminAccounts && (
            <button
              onClick={() => setAddingAdminAccount(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-bb-navy to-bb-navy/90 border border-bb-navy/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-4 py-2 text-sm font-semibold text-white transition-all active:scale-[0.98]"
            >
              <Plus size={16} />
              Gumawa ng Admin Account
            </button>
          )}
        </div>
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
                    onClick={() => requestRoleDecision(u, 'approve')}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-b from-green-600 to-green-700/90 border border-green-600/10 shadow-xs hover:shadow-sm px-3 py-1.5 text-xs font-semibold text-white hover:from-green-700 hover:to-green-800 transition-all"
                  >
                    <Check size={12} />
                    Aprubahan
                  </button>
                  <button
                    onClick={() => requestRoleDecision(u, 'reject')}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-b from-gray-400 to-gray-500/90 border border-gray-400/10 shadow-xs hover:shadow-sm px-3 py-1.5 text-xs font-semibold text-white hover:from-gray-500 hover:to-gray-600 transition-all"
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

      {showResidents && (
      <>
      <div className="mt-4 max-w-md">
        <SearchInput value={query} onChange={setQuery} placeholder="Hanapin ang User..." />
      </div>

      <div className="mt-4 max-h-[calc(100vh-360px)] overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
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
                        className="rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-xs hover:shadow-sm hover:from-bb-blue-dark hover:to-bb-blue-dark px-3 py-1.5 text-xs font-semibold text-white transition-all"
                      >
                        View full Profile
                      </button>
                      {isAdmin && action && (
                        <button
                          onClick={() => setPendingStatusActionId(u.id)}
                          className={`rounded-lg border border-black/5 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:shadow-sm transition-all hover:brightness-105 active:scale-[0.96] ${action.className}`}
                        >
                          {action.label}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setPendingDeleteId(u.id)}
                          className="flex items-center gap-1 rounded-lg bg-gradient-to-b from-gray-400 to-gray-500/90 border border-gray-400/10 shadow-xs hover:shadow-sm px-3 py-1.5 text-xs font-semibold text-white hover:from-gray-500 hover:to-gray-600 transition-all"
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
      </>
      )}

      {showAdminAccounts && (
        <div className="mt-4 max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Pangalan</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Tungkulin</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-700">
                      <div className="font-medium">{a.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                        <span>ID: {maskId(a.id)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(a.id)}
                          className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                          title="Kopyahin ang ID"
                        >
                          {copiedId === a.id ? (
                            <Check size={12} className="text-green-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.email}</td>
                    <td className="px-4 py-3 text-gray-500">{a.role}</td>
                    <td className="px-4 py-3">
                      {a.mustChangePassword ? (
                        <Pill color="orange" solid>
                          Pansamantalang Password
                        </Pill>
                      ) : (
                        <Pill color="green" solid>
                          Aktibo
                        </Pill>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPendingResetId(a.id)}
                          className="flex items-center gap-1 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600/90 border border-orange-500/10 shadow-xs hover:shadow-sm px-3 py-1.5 text-xs font-semibold text-white hover:from-orange-600 hover:to-orange-700 transition-all"
                        >
                          <KeyRound size={12} />
                          I-reset ang Password
                        </button>
                        <button
                          onClick={() => setPendingAdminDeleteId(a.id)}
                          disabled={a.id === user.id}
                          className="flex items-center gap-1 rounded-lg bg-gradient-to-b from-gray-400 to-gray-500/90 border border-gray-400/10 shadow-xs hover:shadow-sm px-3 py-1.5 text-xs font-semibold text-white hover:from-gray-500 hover:to-gray-600 transition-all disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {showModuleAccess && (
        <div className="mt-4">
          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            <SlidersHorizontal size={15} className="mt-0.5 shrink-0" />
            <span>
              Palaging naka-on ang Dashboard at Profile Management para sa lahat ng tungkulin.
              Ang mga naka-off na module dito ay hindi lalabas sa sidebar at hindi ma-a-access
              ng tungkuling iyon.
            </span>
          </div>

          <div className="mt-3 max-h-[calc(100vh-320px)] overflow-auto rounded-lg border border-gray-300">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="border-b border-r border-gray-300 px-4 py-3 font-semibold">Module</th>
                  {ASSIGNABLE_MODULE_ROLES.map((role, idx) => (
                    <th
                      key={role}
                      className={`border-b border-gray-300 px-4 py-3 text-center font-semibold ${
                        idx !== ASSIGNABLE_MODULE_ROLES.length - 1 ? 'border-r' : ''
                      }`}
                    >
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSIGNABLE_MODULES.map(({ key, label }) => (
                  <tr key={key} className="border-b border-gray-200 last:border-b-0 even:bg-gray-50/60">
                    <td className="border-r border-gray-300 px-4 py-3 font-medium text-gray-700">
                      {label}
                    </td>
                    {ASSIGNABLE_MODULE_ROLES.map((role, idx) => {
                      const enabled = roleModuleAccess[role]?.[key] ?? false
                      return (
                        <td
                          key={role}
                          className={`px-4 py-3 text-center ${
                            idx !== ASSIGNABLE_MODULE_ROLES.length - 1 ? 'border-r border-gray-200' : ''
                          }`}
                        >
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`${label} para sa ${role}`}
                            onClick={() => requestModuleToggle(role, key, label, !enabled)}
                            className={`group relative inline-flex h-6 w-12 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                              enabled
                                ? 'border-green-600 bg-green-500 hover:bg-green-600 focus-visible:ring-green-500'
                                : 'border-gray-300 bg-gray-200 hover:bg-gray-300 focus-visible:ring-gray-400'
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
                                enabled ? 'translate-x-[26px]' : 'translate-x-0.5'
                              }`}
                            >
                              {enabled ? (
                                <Check size={12} strokeWidth={3} className="text-green-600" />
                              ) : (
                                <XIcon size={12} strokeWidth={3} className="text-gray-400" />
                              )}
                            </span>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={addingAdminAccount}
        onClose={() => setAddingAdminAccount(false)}
        title="Gumawa ng Admin Portal Account"
      >
        <form onSubmit={submitNewAdminAccount} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Buong Pangalan</span>
            <input
              type="text"
              required
              value={newAdminAccount.name}
              onChange={(e) => setNewAdminAccount((a) => ({ ...a, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Opisyal na Email</span>
            <input
              type="email"
              required
              value={newAdminAccount.email}
              onChange={(e) => setNewAdminAccount((a) => ({ ...a, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Tungkulin</span>
            <select
              value={newAdminAccount.role}
              onChange={(e) => setNewAdminAccount((a) => ({ ...a, role: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            >
              {PORTAL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Pansamantalang Password
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={newAdminAccount.tempPassword}
                onChange={(e) => setNewAdminAccount((a) => ({ ...a, tempPassword: e.target.value }))}
                placeholder="hal. Barangay#1234"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
              <button
                type="button"
                onClick={() =>
                  setNewAdminAccount((a) => ({ ...a, tempPassword: generateTempPassword() }))
                }
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                <Dices size={14} />
                Bumuo
              </button>
            </div>
            <span className="mt-1 block text-xs text-gray-400">
              Kailangan itong palitan ng user sa unang pag-login.
            </span>
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-bb-navy py-2.5 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
          >
            Gumawa ng Account
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingResetId != null}
        onClose={() => setPendingResetId(null)}
        onConfirm={confirmResetAdminPassword}
        title="I-reset ang Password"
        message="Isang bagong pansamantalang password ang bubuuin, at kakailanganin ng user na palitan ito sa susunod niyang pag-login."
        confirmLabel="I-reset"
        danger={false}
      />

      <ConfirmDialog
        open={pendingModuleToggle != null}
        onClose={() => setPendingModuleToggle(null)}
        onConfirm={confirmModuleToggle}
        title={pendingModuleToggle?.enabled ? 'I-on ang Module' : 'I-off ang Module'}
        message={
          pendingModuleToggle
            ? pendingModuleToggle.enabled
              ? `Sigurado ka bang gusto mong i-on ang "${pendingModuleToggle.moduleLabel}" para sa tungkuling ${pendingModuleToggle.role}? Makikita na nila ito sa sidebar at magkakaroon sila ng access dito.`
              : `Sigurado ka bang gusto mong i-off ang "${pendingModuleToggle.moduleLabel}" para sa tungkuling ${pendingModuleToggle.role}? Mawawala ito sa sidebar nila at hindi na nila maaring ma-access ang module na ito.`
            : ''
        }
        confirmLabel={pendingModuleToggle?.enabled ? 'I-on' : 'I-off'}
        danger={!pendingModuleToggle?.enabled}
      />

      <ConfirmDialog
        open={pendingAdminDeleteId != null}
        onClose={() => setPendingAdminDeleteId(null)}
        onConfirm={confirmDeleteAdminAccount}
        title="Tanggalin ang Admin Account"
        message="Sigurado ka bang gusto mong tanggalin ang admin portal account na ito? Hindi na ito maibabalik."
        confirmLabel="Tanggalin"
      />

      <Modal open={!!viewingUser} onClose={() => setViewingId(null)} title="Buong Profile ng User">
        {viewingUser && (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-gray-900">{viewingUser.name}</h4>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-gray-500">{viewingUser.role}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>ID: {maskId(viewingUser.id)}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(viewingUser.id)}
                      className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                      title="Kopyahin ang ID"
                    >
                      {copiedId === viewingUser.id ? (
                        <Check size={12} className="text-green-600" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>
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
                      onClick={() => requestRoleAssignment(viewingUser)}
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
                  onClick={() => setPendingStatusActionId(viewingUser.id)}
                  className={`rounded-lg border border-black/5 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:shadow-sm transition-all hover:brightness-105 active:scale-[0.98] ${ACTION_BY_STATUS[viewingUser.status].className}`}
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
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">First Name</span>
              <input
                type="text"
                required
                value={newAccount.first_name}
                onChange={(e) => setNewAccount((a) => ({ ...a, first_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Last Name</span>
              <input
                type="text"
                required
                value={newAccount.last_name}
                onChange={(e) => setNewAccount((a) => ({ ...a, last_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Purok / Address</span>
            <input
              type="text"
              required
              value={newAccount.address}
              onChange={(e) => setNewAccount((a) => ({ ...a, address: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Email Address</span>
            <input
              type="email"
              required
              value={newAccount.email}
              onChange={(e) => setNewAccount((a) => ({ ...a, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Password</span>
            <input
              type="password"
              required
              value={newAccount.password}
              onChange={(e) => setNewAccount((a) => ({ ...a, password: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-2.5 font-semibold text-white transition-all active:scale-[0.98]"
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

      <ConfirmDialog
        open={pendingStatusActionId != null}
        onClose={() => setPendingStatusActionId(null)}
        onConfirm={confirmStatusAction}
        title={
          pendingStatusUser && pendingStatusActionMeta ? pendingStatusActionMeta.confirmTitle : ''
        }
        message={
          pendingStatusUser && pendingStatusActionMeta
            ? pendingStatusActionMeta.confirmMessage(pendingStatusUser.name)
            : ''
        }
        confirmLabel={pendingStatusActionMeta?.label ?? 'Kumpirmahin'}
        danger={pendingStatusActionMeta?.danger ?? false}
      />

      <ConfirmDialog
        open={pendingRoleAssignment != null}
        onClose={() => setPendingRoleAssignment(null)}
        onConfirm={confirmRoleAssignment}
        title="I-assign ang Tungkulin"
        message={
          pendingRoleAssignment
            ? `Sigurado ka bang gusto mong gawing ${pendingRoleAssignment.role} si ${pendingRoleAssignment.targetUser.name}? ${
                ROLES_REQUIRING_PB_APPROVAL.includes(pendingRoleAssignment.role)
                  ? 'Isusumite ito bilang kahilingan para sa PB approval.'
                  : 'Agad itong magkakabisa.'
              }`
            : ''
        }
        confirmLabel="I-assign"
        danger={false}
      />

      <ConfirmDialog
        open={pendingRoleDecision != null}
        onClose={() => setPendingRoleDecision(null)}
        onConfirm={confirmRoleDecision}
        title={pendingRoleDecision?.decision === 'approve' ? 'Aprubahan ang Kahilingan' : 'Tanggihan ang Kahilingan'}
        message={
          pendingRoleDecision
            ? pendingRoleDecision.decision === 'approve'
              ? `Sigurado ka bang gusto mong aprubahan na gawing ${pendingRoleDecision.targetUser.pendingRoleRequest?.requestedRole} si ${pendingRoleDecision.targetUser.name}?`
              : `Sigurado ka bang gusto mong tanggihan ang kahilingan sa tungkulin ni ${pendingRoleDecision.targetUser.name}?`
            : ''
        }
        confirmLabel={pendingRoleDecision?.decision === 'approve' ? 'Aprubahan' : 'Tanggihan'}
        danger={pendingRoleDecision?.decision === 'reject'}
      />
    </div>
  )
}
