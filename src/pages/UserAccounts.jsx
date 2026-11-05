import FilterPopup from '../components/FilterPopup'
import './UserAccounts.css'
import { useMemo, useState, useEffect } from 'react'
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
  Clock,
  Copy,
  MoreVertical,
  Eye,
  Users,
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
  roleDisplayName,
} from '../config/permissions'

const PORTAL_ROLES = [
  ROLES.SECRETARY,
  ROLES.TANOD,
  ROLES.LUPON,
  ROLES.KAGAWAD,
  ROLES.CAPTAIN,
  ROLES.ADMIN,
]

const ADMIN_ROLE_FILTERS = [
  { value: 'All', label: 'Lahat', activeClass: 'bg-bb-blue text-white shadow-sm' },
  { value: ROLES.CAPTAIN, label: 'Barangay Captain', activeClass: 'bg-emerald-600 text-white shadow-sm' },
  { value: ROLES.SECRETARY, label: 'Secretary', activeClass: 'bg-blue-600 text-white shadow-sm' },
  { value: ROLES.TANOD, label: 'Tanod', activeClass: 'bg-teal-600 text-white shadow-sm' },
  { value: ROLES.KAGAWAD, label: 'Kagawad', activeClass: 'bg-indigo-600 text-white shadow-sm' },
  { value: ROLES.LUPON, label: 'Lupon Member', activeClass: 'bg-amber-600 text-white shadow-sm' },
  { value: ROLES.ADMIN, label: 'System Admin', activeClass: 'bg-purple-600 text-white shadow-sm' },
]

function matchesRoleFilter(accountRole, filterVal) {
  if (filterVal === 'All') return true
  if (!accountRole) return false
  if (accountRole === filterVal) return true
  const normAcc = accountRole.toLowerCase()
  const normFilter = filterVal.toLowerCase()
  if (normAcc === normFilter) return true
  if (normFilter.includes('captain') && (normAcc.includes('captain') || normAcc.includes('punong barangay'))) return true
  if (normFilter.includes('secretary') && normAcc.includes('secretary')) return true
  if (normFilter.includes('tanod') && normAcc.includes('tanod')) return true
  if (normFilter.includes('lupon') && normAcc.includes('lupon')) return true
  if (normFilter.includes('kagawad') && normAcc.includes('kagawad')) return true
  if ((normFilter.includes('admin') || normFilter.includes('administrator')) && (normAcc.includes('admin') || normAcc.includes('administrator'))) return true
  return false
}

const BLANK_ADMIN_ACCOUNT = { name: '', email: '', role: PORTAL_ROLES[0], tempPassword: '' }

function generateTempPassword() {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `Barangay#${digits}`
}

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: 'bg-gray-200', textColor: 'text-gray-400' }
  if (password.length < 8) return { score: 0, label: 'Masyadong maikli', color: 'bg-red-500', textColor: 'text-red-500' }

  let score = 0
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: 'Mahina', color: 'bg-red-500', textColor: 'text-red-500' }
  if (score === 2) return { score: 2, label: 'Katamtaman', color: 'bg-orange-500', textColor: 'text-orange-500' }
  if (score === 3) return { score: 3, label: 'Malakas', color: 'bg-green-500', textColor: 'text-green-500' }
  
  if (password.length >= 12) {
    return { score: 4, label: 'Napakahusay', color: 'bg-emerald-600', textColor: 'text-emerald-600' }
  }
  return { score: 3, label: 'Malakas', color: 'bg-green-500', textColor: 'text-green-500' }
}

const STATUS_COLOR = {
  Active: 'green',
  Pending: 'orange',
  Suspended: 'red',
  Deactivated: 'gray',
}

const STATUS_ORDER = {
  Active: 1,
  Pending: 2,
  Suspended: 3,
  Deactivated: 4,
}

const BARANGAY_ID_STATUS_BADGE = {
  Pending: { label: 'Hindi Beripikado', color: 'gray', icon: AlertCircle },
  unverified: { label: 'Hindi Beripikado', color: 'gray', icon: AlertCircle },
  secretary_verified: { label: 'Beripikado ng Sekretarya', color: 'orange', icon: Clock },
  pb_authorized: { label: 'Awtorisado ng Punong Barangay', color: 'green', icon: CheckCircle2 },
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

// Aligned with Mobile App Registration Fields + required fields for Supabase auth
const BLANK_NEW_ACCOUNT = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  purok: '',
  password: '',
}

function formatE164(rawPhone) {
  const cleaned = rawPhone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) return `+63${cleaned.slice(1)}`
  if (cleaned.startsWith('63')) return `+${cleaned}`
  return `+${cleaned}`
}

function maskId(id) {
  if (!id) return ''
  // Mask all characters except hyphens and spaces to ensure a clean mask presentation
  return id.replace(/[^-\s]/g, '*')
}

export default function UserAccounts() {
  const {
    user,
    accounts,
    createAdminAccount,
    createResidentAccount,
    resetAdminAccountPassword,
    deleteAdminAccount,
    updateAdminAccountRole,
    updateAdminAccountCommittee,
    committees,
  } = useAuth()
  const { users, updateUser, removeUser, addAuditEntry, roleModuleAccess, setModuleAccess, fetchData } = useData()
  const { showToast } = useToast()

  const [copiedId, setCopiedId] = useState(null)

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const isAdmin = user?.role === ROLES.ADMIN || user?.role === 'System Administrator' || user?.role === 'System Admin' || (user?.role || '').toLowerCase().includes('admin')
  const isCaptain = user?.role === ROLES.CAPTAIN || user?.role === 'Barangay Captain'
  const isSecretary = user?.role === ROLES.SECRETARY || user?.role === 'Barangay Secretary'

  const [activeTab, setActiveTab] = useState('residents') // 'residents' | 'admin' | 'modules'
  const [addingAdminAccount, setAddingAdminAccount] = useState(false)
  const [newAdminAccount, setNewAdminAccount] = useState(BLANK_ADMIN_ACCOUNT)
  const [pendingResetId, setPendingResetId] = useState(null)
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [editingRoleAdmin, setEditingRoleAdmin] = useState(null)
  const [selectedNewRole, setSelectedNewRole] = useState('')
  const [selectedCommitteeId, setSelectedCommitteeId] = useState('')
  const [pendingAdminDeleteId, setPendingAdminDeleteId] = useState(null)
  const [pendingModuleToggle, setPendingModuleToggle] = useState(null)
  const [pendingStatusActionId, setPendingStatusActionId] = useState(null)
  const [pendingRoleAssignment, setPendingRoleAssignment] = useState(null)
  const [pendingRoleDecision, setPendingRoleDecision] = useState(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [adminQuery, setAdminQuery] = useState('')
  const [adminRoleFilter, setAdminRoleFilter] = useState('All')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [roleChoice, setRoleChoice] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccount, setNewAccount] = useState(BLANK_NEW_ACCOUNT)

  const filteredAdminAccounts = useMemo(() => {
    let result = accounts || []

    if (adminRoleFilter !== 'All') {
      result = result.filter((a) => matchesRoleFilter(a.role, adminRoleFilter))
    }

    const q = adminQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (a) =>
          (a.name && a.name.toLowerCase().includes(q)) ||
          (a.id && a.id.toLowerCase().includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.role && a.role.toLowerCase().includes(q))
      )
    }

    return result
  }, [accounts, adminRoleFilter, adminQuery])

  const filtered = useMemo(() => {
    let result = users

    if (statusFilter !== 'All') {
      result = result.filter((u) => {
        const status = u.status || 'Active'
        return status.toLowerCase() === statusFilter.toLowerCase()
      })
    }

    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.id && u.id.toLowerCase().includes(q)) ||
          (u.phone && u.phone.includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.address && u.address.toLowerCase().includes(q))
      )
    }

    // Sort: Active users at the top, then Pending, Suspended, Deactivated
    return [...result].sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] || 99
      const orderB = STATUS_ORDER[b.status] || 99
      return orderA - orderB
    })
  }, [users, query, statusFilter])

  const pendingRequests = useMemo(() => users.filter((u) => u.pendingRoleRequest), [users])

  useEffect(() => {
    if (openMenuId === null) return

    const handleUserScrollGesture = () => {
      setOpenMenuId(null)
    }

    window.addEventListener('wheel', handleUserScrollGesture, { passive: true })
    window.addEventListener('touchmove', handleUserScrollGesture, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleUserScrollGesture)
      window.removeEventListener('touchmove', handleUserScrollGesture)
    }
  }, [openMenuId])

  useEffect(() => {
    if (!openMenuId) return

    const timer = setTimeout(() => {
      const el = document.getElementById(`dropdown-menu-${openMenuId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 80)

    return () => clearTimeout(timer)
  }, [openMenuId])

  const viewingUser = users.find((u) => u.id === viewingId) ?? null
  const pendingStatusUser = users.find((u) => u.id === pendingStatusActionId) ?? null
  const pendingStatusActionMeta = pendingStatusUser ? ACTION_BY_STATUS[pendingStatusUser.status] : null

  function applyAction(id) {
    const target = users.find((u) => u.id === id)
    const action = target && ACTION_BY_STATUS[target.status]
    if (!action) return

    const patch = { status: action.next }
    if (target.status === 'Pending' && action.next === 'Active') {
      patch.verified = 'Verified'
      patch.barangayIdStatus = 'pb_authorized'
    }

    updateUser(id, patch)
    const colorByNext = { Active: 'green', Suspended: 'orange', Deactivated: 'red' }
    addAuditEntry(`${action.label} User ID ${target.id}`, { color: colorByNext[action.next], targetTable: 'users', targetKey: target.id, before: { status: target.status, role: target.role, verification: target.barangayIdStatus }, after: patch })
    showToast(action.toast ?? 'Na-update ang account.')
  }

  function confirmStatusAction() {
    if (!pendingStatusActionId) return
    applyAction(pendingStatusActionId)
    setPendingStatusActionId(null)
    setViewingId(null)
  }

  function updateBarangayIdStatus(targetUser, newStatus) {
    const patch = { barangayIdStatus: newStatus }
    if (newStatus === 'pb_authorized') {
      patch.status = 'Active'
      patch.verified = 'Verified'
    }
    updateUser(targetUser.id, patch)
    const targetName = targetUser.name || targetUser.fullName || `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim()
    const statusLabel = BARANGAY_ID_STATUS_BADGE[newStatus]?.label || newStatus
    addAuditEntry(`In-update ang Barangay ID Status ni ${targetName} sa "${statusLabel}"`, {
      color: newStatus === 'pb_authorized' ? 'green' : 'orange',
      targetTable: 'users', targetKey: targetUser.id,
      before: { barangay_id_status: targetUser.barangayIdStatus, account_status: targetUser.status }, after: patch,
    })
    showToast(
      newStatus === 'pb_authorized'
        ? `In-update ang status ni ${targetName} sa "${statusLabel}" at na-activate na ang account.`
        : `In-update ang status ni ${targetName} sa "${statusLabel}".`
    )
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
    const userName = targetUser.name || targetUser.fullName
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
      addAuditEntry(`Humiling ng tungkuling ${role} para kay ${userName}`, { color: 'orange', targetTable: 'users', targetKey: targetUser.id, before: { role: targetUser.role }, after: { requested_role: role, request_status: 'pending' } })
      showToast(`Naisumite ang kahilingan na gawing ${role} si ${userName} — naghihintay ng PB approval.`)
    } else {
      updateUser(targetUser.id, { role, status: 'Active' })
      addAuditEntry(`Nag-assign ng tungkuling ${role} kay ${userName}`, { color: 'blue', targetTable: 'users', targetKey: targetUser.id, before: { role: targetUser.role, status: targetUser.status }, after: { role, status: 'Active' } })
      showToast(`Na-assign si ${userName} bilang ${role}.`)
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
    const userName = targetUser.name || targetUser.fullName
    if (decision === 'approve') {
      const requestedRole = targetUser.pendingRoleRequest.requestedRole
      updateUser(targetUser.id, {
        role: requestedRole,
        status: 'Active',
        pendingRoleRequest: null,
      })
      addAuditEntry(`Inaprubahan ang tungkuling ${requestedRole} para kay ${userName}`, { color: 'green', targetTable: 'users', targetKey: targetUser.id, before: { role: targetUser.role, pending_role: requestedRole }, after: { role: requestedRole, pending_role: null } })
      showToast(`Na-approve: si ${userName} ngayon ay ${requestedRole}.`)
    } else {
      updateUser(targetUser.id, { pendingRoleRequest: null })
      addAuditEntry(`Tinanggihan ang kahilingan sa tungkulin ni ${userName}`, { color: 'red', targetTable: 'users', targetKey: targetUser.id, before: { pending_role: targetUser.pendingRoleRequest?.requestedRole }, after: { pending_role: null, decision: 'rejected' } })
      showToast(`Tinanggihan ang kahilingan para kay ${userName}.`, 'error')
    }
    setPendingRoleDecision(null)
  }

  function confirmDelete() {
    const target = users.find((u) => u.id === pendingDeleteId)
    removeUser(pendingDeleteId)
    addAuditEntry(`Tinanggal ang account ni ${target?.name || target?.fullName || pendingDeleteId}`, { color: 'red', targetTable: 'users', targetKey: pendingDeleteId, before: target ? { status: target.status, role: target.role } : null, after: null })
    showToast(`Tinanggal ang account ni ${target?.name || target?.fullName || ''}.`)
  }

  async function submitNewAccount(e) {
    e.preventDefault()
    if (
      !newAccount.firstName.trim() ||
      !newAccount.lastName.trim() ||
      !newAccount.email.trim() ||
      !newAccount.password.trim() ||
      !newAccount.phone.trim()
    ) {
      showToast('Kumpletuhin ang lahat ng kailangang field.', 'error')
      return
    }

    const res = await createResidentAccount({
      first_name: newAccount.firstName.trim(),
      last_name: newAccount.lastName.trim(),
      address: newAccount.purok.trim() || 'Purok 1',
      email: newAccount.email.trim(),
      password: newAccount.password.trim(),
    })

    if (!res.success) {
      showToast(res.error || 'May error sa paglikha ng account.', 'error')
      return
    }

    if (res.user) {
      const formattedPhone = formatE164(newAccount.phone.trim())
      await updateUser(res.user.id, { phone: formattedPhone })
    }

    const fullName = `${newAccount.firstName.trim()} ${newAccount.lastName.trim()}`
    addAuditEntry(`Nagdagdag ng bagong resident account: ${fullName}`, { color: 'green', targetTable: 'users', targetKey: res.user?.id, after: { role: 'Residente', status: 'Pending' } })
    showToast(`Naidagdag ang account ni ${fullName}. Naghihintay ng pag-apruba.`)
    
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
      { color: 'green', targetTable: 'users', targetKey: result.account?.id, after: { role: newAdminAccount.role, must_change_password: true } },
    )
    showToast(`Nagawa ang admin account ni ${newAdminAccount.name.trim()}. Kailangan niyang baguhin ang password sa unang login.`)
    setNewAdminAccount(BLANK_ADMIN_ACCOUNT)
    setAddingAdminAccount(false)
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault()
    if (!resetPasswordValue.trim()) {
      showToast('Ilagay ang bagong password.', 'error')
      return
    }
    if (resetPasswordValue.trim().length < 8) {
      showToast('Dapat hindi bababa sa 8 karakter ang password.', 'error')
      return
    }

    const account = accounts.find((a) => a.id === pendingResetId)
    if (!account) return

    const result = await resetAdminAccountPassword(account.id, resetPasswordValue.trim(), false)
    
    if (result && !result.success) {
      showToast(result.error || 'Hindi ma-update ang password.', 'error')
      return
    }

    addAuditEntry(`Nag-reset ng password para sa admin account ni ${account.name}`, { color: 'orange', targetTable: 'users', targetKey: account.id, after: { password_reset: true, password_value: '[redacted]' } })
    showToast(`Bagong password para kay ${account.name} ay na-save na.`)
    setPendingResetId(null)
    setResetPasswordValue('')
  }

  async function handleAdminRoleChangeSubmit(e) {
    e.preventDefault()
    if (!isAdmin || !editingRoleAdmin || !selectedNewRole) return

    const targetAccount = editingRoleAdmin
    const oldRole = targetAccount.role
    const newRole = selectedNewRole
    const nextCommitteeId = newRole === ROLES.KAGAWAD ? selectedCommitteeId : ''
    const roleChanged = newRole !== oldRole
    const committeeChanged = String(targetAccount.committeeId || '') !== String(nextCommitteeId || '')
    if (!roleChanged && !committeeChanged) return
    if (newRole === ROLES.KAGAWAD && !nextCommitteeId) {
      showToast('Pumili ng komite para sa Kagawad account.', 'error')
      return
    }

    if (roleChanged) {
      const res = await updateAdminAccountRole(targetAccount.id, newRole)
      if (res && !res.success) {
        showToast(res.error || 'Hindi nabago ang tungkulin.', 'error')
        return
      }
    }
    if (committeeChanged) {
      const committeeResult = await updateAdminAccountCommittee(targetAccount.id, nextCommitteeId || null)
      if (!committeeResult?.success) {
        showToast(committeeResult?.error || 'Hindi na-save ang komite.', 'error')
        return
      }
    }

    addAuditEntry(
      `Binago ang tungkulin ni ${targetAccount.name} mula "${oldRole}" patungong "${newRole}"`,
      { color: 'blue', targetTable: 'users', targetKey: targetAccount.id, before: { role: oldRole, committee_id: targetAccount.committeeId || null }, after: { role: newRole, committee_id: nextCommitteeId ? Number(nextCommitteeId) : null } }
    )
    showToast(`Matagumpay na nabago ang tungkulin ni ${targetAccount.name} bilang ${newRole}.`)
    fetchData()
    setEditingRoleAdmin(null)
    setSelectedNewRole('')
    setSelectedCommitteeId('')
  }

  async function confirmDeleteAdminAccount() {
    const account = accounts.find((a) => a.id === pendingAdminDeleteId)
    if (!account) return
    await deleteAdminAccount(account.id)
    addAuditEntry(`Tinanggal ang admin portal account ni ${account.name}`, { color: 'red', targetTable: 'users', targetKey: account.id, before: { role: account.role, status: account.status }, after: null })
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
      { color: enabled ? 'green' : 'orange', targetTable: 'role_module_access', targetKey: `${role}:${moduleKey}`, before: { role, module: moduleKey, enabled: !enabled }, after: { role, module: moduleKey, enabled } },
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
  const residentMetrics = [
    { value: 'All', label: 'Lahat ng account', count: users.length, tone: 'blue' },
    { value: 'Active', label: 'Aktibo', count: users.filter((account) => (account.status || 'Active') === 'Active').length, tone: 'green' },
    { value: 'Pending', label: 'Naghihintay', count: users.filter((account) => account.status === 'Pending').length, tone: 'amber' },
    { value: 'Suspended', label: 'Suspendido', count: users.filter((account) => account.status === 'Suspended').length, tone: 'red' },
    { value: 'Deactivated', label: 'Deaktibo', count: users.filter((account) => account.status === 'Deactivated').length, tone: 'slate' },
  ]
  const adminReadyCount = accounts.filter((account) => !account.mustChangePassword).length
  const temporaryPasswordCount = accounts.length - adminReadyCount
  const enabledModuleCount = ASSIGNABLE_MODULES.reduce(
    (total, module) => total + ASSIGNABLE_MODULE_ROLES.filter((role) => roleModuleAccess[role]?.[module.key]).length,
    0,
  )

  return (
    <div className="user-accounts-page">
      <section className="account-command-bar">
        <div className="account-command-copy">
          <span className="account-command-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
          <div>
            <p className="account-command-kicker">Identity & access workspace</p>
            <h2>
            {showAdminAccounts
              ? 'Mga Admin Portal Account'
              : showModuleAccess
                ? 'Pamamahagi ng Access sa Module'
                : 'Mga Account ng Resident'}
            </h2>
            <p>
            {showAdminAccounts
              ? 'Mga account na maaaring mag-login sa Command Center na ito.'
              : showModuleAccess
                ? 'Piliin kung aling mga module ang makikita at ma-a-access ng bawat tungkulin (role).'
                : 'Suriin ang mga nakarehistro sa mobile app at i-manage ang kanilang governance approval.'}
            </p>
          </div>
        </div>
        <div className="account-command-actions">
          {isAdmin && (
            <nav className="account-section-nav" aria-label="Mga seksyon ng user account">
              <button
                type="button"
                onClick={() => setActiveTab('residents')}
                aria-current={activeTab === 'residents' ? 'page' : undefined}
                className={activeTab === 'residents' ? 'is-active' : ''}
              >
                <Users size={15} /> <span>Mga Residente</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                aria-current={activeTab === 'admin' ? 'page' : undefined}
                className={activeTab === 'admin' ? 'is-active' : ''}
              >
                <ShieldCheck size={15} /> <span>Admin Portal</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('modules')}
                aria-current={activeTab === 'modules' ? 'page' : undefined}
                className={activeTab === 'modules' ? 'is-active' : ''}
              >
                <SlidersHorizontal size={15} /> <span>Module Access</span>
              </button>
            </nav>
          )}
          {isAdmin && activeTab === 'residents' && (
            <button
              type="button"
              onClick={() => setAddingAccount(true)}
              className="account-primary-action"
            >
              <Plus size={16} />
              Magdagdag ng Resident
            </button>
          )}
          {showAdminAccounts && (
            <button
              type="button"
              onClick={() => setAddingAdminAccount(true)}
              className="account-primary-action"
            >
              <Plus size={16} />
              Gumawa ng Admin Account
            </button>
          )}
        </div>
      </section>

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
                    {u.name || u.fullName} → {u.pendingRoleRequest.requestedRole}
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
          <section className="account-metric-grid" aria-label="Buod ng mga resident account">
            {residentMetrics.map((metric) => (
              <button
                type="button"
                key={metric.value}
                onClick={() => setStatusFilter(metric.value)}
                aria-pressed={statusFilter === metric.value}
                className={`account-metric tone-${metric.tone} ${statusFilter === metric.value ? 'is-active' : ''}`}
              >
                <span className="account-metric-label"><i aria-hidden="true" />{metric.label}</span>
                <strong>{metric.count}</strong>
              </button>
            ))}
          </section>

          <section className="account-registry-panel">
            <div className="account-registry-toolbar">
              <div>
                <p className="account-registry-eyebrow">Resident registry</p>
                <p className="account-registry-count"><strong>{filtered.length}</strong> sa {users.length} account</p>
              </div>
              <div className="account-registry-tools">
                <FilterPopup title="Filter resident accounts" resultNoun="accounts" count={filtered.length} onReset={() => setStatusFilter('All')}><label><span>Status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>{['All','Active','Pending','Suspended','Deactivated'].map(status => <option key={status}>{status}</option>)}</select></label></FilterPopup>
                <div className="account-search-wrap">
                  <SearchInput value={query} onChange={setQuery} placeholder="Hanapin ang pangalan, phone, o ID..." />
                </div>
              </div>
            </div>

          <div className="account-table-shell min-h-[320px] max-h-[calc(100vh-390px)] overflow-auto pb-20">
            <table className="account-registry-table w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">User ID</th>
                  <th className="px-4 py-3 font-semibold">Pangalan</th>
                  <th className="px-4 py-3 font-semibold">Telepono / Purok</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Barangay ID Status</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, index) => {
                  const action = ACTION_BY_STATUS[u.status]
                  const idStatusKey = u.barangayIdStatus || 'unverified'
                  const idStatusMeta = BARANGAY_ID_STATUS_BADGE[idStatusKey] || BARANGAY_ID_STATUS_BADGE.unverified
                  const StatusIcon = idStatusMeta.icon
                  const openUpward = filtered.length >= 4 && index >= filtered.length - 2 && index >= 2

                  return (
                    <tr id={`user-row-${u.id}`} key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-gray-700 whitespace-nowrap">
                          <span className="whitespace-nowrap">{maskId(u.id)}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(u.id)}
                            className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                            title="Kopyahin ang ID"
                          >
                            {copiedId === u.id ? (
                              <Check size={12} className="text-green-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-semibold">
                        {u.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div>{u.phone || '—'}</div>
                        <div className="text-xs text-gray-400">{u.address || 'Purok N/A'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {u.role || 'Residente'}
                        {u.pendingRoleRequest && (
                          <span className="ml-1 text-xs text-orange-500 font-medium font-semibold">
                            (→ {u.pendingRoleRequest.requestedRole} pending)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Pill color={idStatusMeta.color} solid={false}>
                          <span className="flex items-center gap-1">
                            <StatusIcon size={13} />
                            {idStatusMeta.label}
                          </span>
                        </Pill>
                      </td>
                      <td className="px-4 py-3">
                        <Pill color={STATUS_COLOR[u.status] ?? 'gray'} solid>
                          {u.status || 'Active'}
                        </Pill>
                      </td>
                      <td className="px-4 py-3 relative">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === u.id ? null : u.id)
                            }}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:bg-gray-150 transition-colors focus:outline-none"
                            title="Higit pang Aksyon"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {openMenuId === u.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(null)
                                }}
                              />
                              <div id={`dropdown-menu-${u.id}`} className={`absolute right-4 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30 text-left ${
                                openUpward ? 'bottom-8 mb-1' : 'top-10 mt-1'
                              }`}>
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    openProfile(u.id)
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  <Eye size={13} className="text-gray-400 shrink-0" />
                                  View Profile
                                </button>

                                {isAdmin && action && (
                                  <button
                                    disabled={action.label === 'Approve' && (idStatusKey === 'unverified' || idStatusKey === 'Pending')}
                                    title={action.label === 'Approve' && (idStatusKey === 'unverified' || idStatusKey === 'Pending') ? 'Kailangang ma-verify muna ang Barangay ID bago aprubahan.' : undefined}
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setPendingStatusActionId(u.id)
                                    }}
                                    className={`flex w-full items-center gap-2 px-4 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                      action.label === 'Approve' || action.label === 'I-reactivate' 
                                        ? 'text-green-600 hover:bg-green-50/50' 
                                        : 'text-orange-600 hover:bg-orange-50/50'
                                    }`}
                                  >
                                    <ShieldCheck size={13} className="shrink-0" />
                                    {action.label === 'Approve' ? 'Approve Account' : action.label}
                                  </button>
                                )}

                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setPendingDeleteId(u.id)
                                    }}
                                    className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 size={13} className="text-red-500 shrink-0" />
                                    Burahin ang Account
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                      Walang nahanap na user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </section>
        </>
      )}

      {showAdminAccounts && (
        <>
          <section className="account-metric-grid account-metric-grid-admin" aria-label="Buod ng mga admin account">
            <div className="account-metric tone-blue"><span className="account-metric-label"><i aria-hidden="true" />Lahat ng admin</span><strong>{accounts.length}</strong></div>
            <div className="account-metric tone-green"><span className="account-metric-label"><i aria-hidden="true" />Handa nang gamitin</span><strong>{adminReadyCount}</strong></div>
            <div className="account-metric tone-amber"><span className="account-metric-label"><i aria-hidden="true" />Temporary password</span><strong>{temporaryPasswordCount}</strong></div>
          </section>

          <section className="account-registry-panel">
            <div className="account-registry-toolbar">
              <div>
                <p className="account-registry-eyebrow">Command Center directory</p>
                <p className="account-registry-count"><strong>{filteredAdminAccounts.length}</strong> sa {accounts.length} admin</p>
              </div>
              <div className="account-admin-tools">
                <FilterPopup title="Filter admin accounts" resultNoun="accounts" count={filteredAdminAccounts.length} onReset={() => setAdminRoleFilter('All')}>                <label >
                  <span>Role</span>
                  <select value={adminRoleFilter} onChange={(event) => setAdminRoleFilter(event.target.value)}>
                    {ADMIN_ROLE_FILTERS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label></FilterPopup>
                <div className="account-search-wrap">
              <SearchInput
                value={adminQuery}
                onChange={setAdminQuery}
                placeholder="Hanapin ang pangalan, email, role, o ID..."
              />
                </div>
              </div>
            </div>

          <div className="account-table-shell min-h-[320px] max-h-[calc(100vh-390px)] overflow-auto pb-20">
            <table className="account-registry-table w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Admin ID</th>
                  <th className="px-4 py-3 font-semibold">Pangalan</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Tungkulin</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Aksyon</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdminAccounts.map((a, index) => {
                  const openUpward = filteredAdminAccounts.length >= 4 && index >= filteredAdminAccounts.length - 2 && index >= 2
                  return (
                    <tr id={`admin-row-${a.id}`} key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium flex items-center gap-1.5 text-xs font-mono text-gray-700 whitespace-nowrap">
                          <span className="whitespace-nowrap">ID: {maskId(a.id)}</span>
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
                      <td className="px-4 py-3 text-gray-700 font-semibold">{a.name}</td>
                      <td className="px-4 py-3 text-gray-500">{a.email}</td>
                      <td className="px-4 py-3 text-gray-500">{roleDisplayName(a.role)}</td>
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
                      <td className="px-4 py-3 relative">
                        <div className="flex justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(openMenuId === a.id ? null : a.id)
                            }}
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-gray-500 hover:bg-gray-150 transition-colors focus:outline-none"
                            title="Higit pang Aksyon"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {openMenuId === a.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(null)
                                }}
                              />
                              <div id={`dropdown-menu-${a.id}`} className={`absolute right-4 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-30 text-left ${
                                openUpward ? 'bottom-8 mb-1' : 'top-10 mt-1'
                              }`}>
                                {isAdmin && (
                                  <button
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setEditingRoleAdmin(a)
                                      setSelectedNewRole(a.role)
                                      setSelectedCommitteeId(String(a.committeeId || ''))
                                    }}
                                    disabled={a.id === user.id}
                                    title={a.id === user.id ? 'Hindi mo maaaring palitan ang sarili mong tungkulin.' : undefined}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <ShieldCheck size={13} className="text-bb-blue shrink-0" />
                                    Palitan ang Tungkulin
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setPendingResetId(a.id)
                                  }}
                                  className={`flex w-full items-center gap-2 px-4 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors ${isAdmin ? 'border-t border-gray-100' : ''}`}
                                >
                                  <KeyRound size={13} className="text-orange-500 shrink-0" />
                                  I-reset ang Password
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setPendingAdminDeleteId(a.id)
                                  }}
                                  disabled={a.id === user.id}
                                  className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Trash2 size={13} className="text-red-500 shrink-0" />
                                  Burahin ang Admin
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredAdminAccounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                      Walang nahanap na admin account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </section>
        </>
      )}

      {showModuleAccess && (
        <div className="account-access-workspace">
          <div className="account-access-summary">
            <div><span>Mga module</span><strong>{ASSIGNABLE_MODULES.length}</strong></div>
            <div><span>Mga tungkulin</span><strong>{ASSIGNABLE_MODULE_ROLES.length}</strong></div>
            <div><span>Aktibong pahintulot</span><strong>{enabledModuleCount}</strong></div>
          </div>
          <div className="account-access-note">
            <SlidersHorizontal size={15} className="mt-0.5 shrink-0" />
            <span>
              Palaging naka-on ang Dashboard at Profile Management para sa lahat ng tungkulin. Ang mga naka-off na
              module dito ay hindi lalabas sa sidebar at hindi ma-a-access ng tungkuling iyon.
            </span>
          </div>

          <div className="account-access-matrix max-h-[calc(100vh-390px)] overflow-auto">
            <table className="account-registry-table w-full border-collapse text-left text-sm">
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
                      {roleDisplayName(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSIGNABLE_MODULES.map(({ key, label }) => (
                  <tr key={key} className="border-b border-gray-200 last:border-b-0 even:bg-gray-50/60">
                    <td className="border-r border-gray-300 px-4 py-3 font-medium text-gray-700">{label}</td>
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
                            aria-label={`${label} para sa ${roleDisplayName(role)}`}
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

      {/* MODAL: View Resident Full Profile */}
      <Modal open={!!viewingUser} onClose={() => setViewingId(null)} title="Buong Profile ng Resident">
        {viewingUser && (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  {viewingUser.name || `${viewingUser.firstName ?? ''} ${viewingUser.lastName ?? ''}`.trim()}
                </h4>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm text-gray-500">{viewingUser.role || 'Residente'}</p>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 whitespace-nowrap">
                    <span className="whitespace-nowrap">ID: {maskId(viewingUser.id)}</span>
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
                {viewingUser.status || 'Active'}
              </Pill>
            </div>

            {/* Governance Status Section */}
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Governance Verification Status
              </p>
              <div className="mt-2 flex items-center justify-between">
                <Pill
                  color={
                    BARANGAY_ID_STATUS_BADGE[viewingUser.barangayIdStatus || 'unverified']?.color || 'gray'
                  }
                >
                  {BARANGAY_ID_STATUS_BADGE[viewingUser.barangayIdStatus || 'unverified']?.label}
                </Pill>

                <div className="flex gap-2">
                  {(isSecretary || isAdmin) && (viewingUser.barangayIdStatus === 'unverified' || viewingUser.barangayIdStatus === 'Pending') && (
                    <button
                      onClick={() => updateBarangayIdStatus(viewingUser, 'secretary_verified')}
                      className="rounded-lg bg-gradient-to-b from-orange-500 to-orange-600/90 border border-orange-500/10 shadow-xs hover:shadow-sm px-3 py-1 text-xs font-semibold text-white hover:from-orange-600 hover:to-orange-700 transition-all"
                    >
                      I-verify bilang Sekretarya
                    </button>
                  )}
                  {(isCaptain || isAdmin) && viewingUser.barangayIdStatus === 'secretary_verified' && (
                    <button
                      onClick={() => updateBarangayIdStatus(viewingUser, 'pb_authorized')}
                      className="rounded-lg bg-gradient-to-b from-green-600 to-green-700/90 border border-green-600/10 shadow-xs hover:shadow-sm px-3 py-1 text-xs font-semibold text-white hover:from-green-700 hover:to-green-800 transition-all"
                    >
                      I-awtorisa (Punong Barangay)
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="shrink-0 text-gray-400" />
                {viewingUser.email || 'Walang email address'}
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="shrink-0 text-gray-400" />
                {viewingUser.phone || 'Walang numero'}
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin size={15} className="shrink-0 text-gray-400" />
                {viewingUser.address || 'Purok N/A'}
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar size={15} className="shrink-0 text-gray-400" />
                Nagparehistro noong {viewingUser.dateRegistered || 'N/A'}
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
                  disabled={
                    ACTION_BY_STATUS[viewingUser.status].label === 'Approve' &&
                    (!viewingUser.barangayIdStatus ||
                      viewingUser.barangayIdStatus === 'unverified' ||
                      viewingUser.barangayIdStatus === 'Pending')
                  }
                  title={
                    ACTION_BY_STATUS[viewingUser.status].label === 'Approve' &&
                    (!viewingUser.barangayIdStatus ||
                      viewingUser.barangayIdStatus === 'unverified' ||
                      viewingUser.barangayIdStatus === 'Pending')
                      ? 'Kailangang ma-verify muna ang Barangay ID bago aprubahan.'
                      : undefined
                  }
                  onClick={() => setPendingStatusActionId(viewingUser.id)}
                  className={`rounded-lg border border-black/5 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:shadow-sm transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100 ${
                    ACTION_BY_STATUS[viewingUser.status].className
                  }`}
                >
                  {ACTION_BY_STATUS[viewingUser.status].label}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL: Add New Resident */}
      <Modal open={addingAccount} onClose={() => setAddingAccount(false)} title="Magdagdag ng Resident Account" maxWidth="max-w-3xl">
        <form onSubmit={submitNewAccount} className="account-create-form">
          <div className="account-create-columns">
            <section className="account-create-section">
              <div className="account-create-section-heading"><span><Users size={18} /></span><div><h4>Resident identity</h4><p>Pangalan at pangunahing contact information.</p></div></div>
              <div className="account-create-name-grid">
                <label><span>First Name</span><input type="text" required value={newAccount.firstName} onChange={(e) => setNewAccount((a) => ({ ...a, firstName: e.target.value }))} placeholder="Juan" /></label>
                <label><span>Last Name</span><input type="text" required value={newAccount.lastName} onChange={(e) => setNewAccount((a) => ({ ...a, lastName: e.target.value }))} placeholder="Dela Cruz" /></label>
              </div>
              <label><span>Mobile Phone Number</span><div className="account-create-input-icon"><Phone size={16} /><input type="text" required value={newAccount.phone} onChange={(e) => setNewAccount((a) => ({ ...a, phone: e.target.value }))} placeholder="09171234567" /></div></label>
              <label><span>Purok / Address</span><div className="account-create-input-icon"><MapPin size={16} /><input type="text" required value={newAccount.purok} onChange={(e) => setNewAccount((a) => ({ ...a, purok: e.target.value }))} placeholder="Purok 3" /></div></label>
            </section>

            <section className="account-create-section account-create-access">
              <div className="account-create-section-heading"><span><KeyRound size={18} /></span><div><h4>Login access</h4><p>Kredensyal para sa resident mobile account.</p></div></div>
              <label><span>Email Address</span><div className="account-create-input-icon"><Mail size={16} /><input type="email" required value={newAccount.email} onChange={(e) => setNewAccount((a) => ({ ...a, email: e.target.value }))} placeholder="juan@example.com" /></div></label>
              <label><span>Password</span><div className="account-create-input-icon"><KeyRound size={16} /><input type="password" required minLength={6} value={newAccount.password} onChange={(e) => setNewAccount((a) => ({ ...a, password: e.target.value }))} placeholder="Hindi bababa sa 6 na karakter" /></div></label>
              <div className="account-create-note"><ShieldCheck size={17} /><p>Ang account ay idaragdag bilang resident at sasailalim pa rin sa kasalukuyang governance verification process.</p></div>
            </section>
          </div>
          <footer className="account-create-footer"><button type="button" onClick={() => setAddingAccount(false)} className="account-create-cancel">Kanselahin</button><button type="submit" className="account-create-submit"><Plus size={17} /> Gumawa ng Resident Account</button></footer>
        </form>
      </Modal>

      {/* MODAL: Create Admin Portal Account */}
      <Modal
        open={addingAdminAccount}
        onClose={() => setAddingAdminAccount(false)}
        title="Gumawa ng Admin Portal Account"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={submitNewAdminAccount} className="account-create-form">
          <div className="account-create-columns">
            <section className="account-create-section">
              <div className="account-create-section-heading"><span><ShieldCheck size={18} /></span><div><h4>Portal identity</h4><p>Opisyal at tungkuling bibigyan ng access.</p></div></div>
              <label><span>Buong Pangalan</span><div className="account-create-input-icon"><Users size={16} /><input type="text" required value={newAdminAccount.name} onChange={(e) => setNewAdminAccount((a) => ({ ...a, name: e.target.value }))} placeholder="Juan Dela Cruz" /></div></label>
              <label><span>Opisyal na Email</span><div className="account-create-input-icon"><Mail size={16} /><input type="email" required value={newAdminAccount.email} onChange={(e) => setNewAdminAccount((a) => ({ ...a, email: e.target.value }))} placeholder="juan@barangay.gov.ph" /></div></label>
              <label><span>Tungkulin</span><select value={newAdminAccount.role} onChange={(e) => setNewAdminAccount((a) => ({ ...a, role: e.target.value }))}>{PORTAL_ROLES.map((role) => <option key={role} value={role}>{roleDisplayName(role)}</option>)}</select></label>
            </section>

            <section className="account-create-section account-create-access">
              <div className="account-create-section-heading"><span><KeyRound size={18} /></span><div><h4>First-login security</h4><p>Temporary credential para sa unang pag-login.</p></div></div>
              <label><span>Pansamantalang Password</span><div className="account-password-generator"><div className="account-create-input-icon"><KeyRound size={16} /><input type="text" required value={newAdminAccount.tempPassword} onChange={(e) => setNewAdminAccount((a) => ({ ...a, tempPassword: e.target.value }))} placeholder="hal. Barangay#1234" /></div><button type="button" onClick={() => setNewAdminAccount((a) => ({ ...a, tempPassword: generateTempPassword() }))}><Dices size={15} /> Bumuo</button></div></label>
              <div className="account-password-strength">
                <div><span>Kahirapan ng password</span><strong className={getPasswordStrength(newAdminAccount.tempPassword).textColor}>{getPasswordStrength(newAdminAccount.tempPassword).label || 'Walang nilalaman'}</strong></div>
                <div className="account-strength-track">{[1, 2, 3, 4].map((score) => <i key={score} className={getPasswordStrength(newAdminAccount.tempPassword).score >= score ? getPasswordStrength(newAdminAccount.tempPassword).color : ''} />)}</div>
              </div>
              <div className="account-create-note"><ShieldCheck size={17} /><p>Hindi bababa sa 8 karakter na may uppercase, lowercase, numero, at special character. Papalitan ito ng user sa unang login.</p></div>
            </section>
          </div>
          <footer className="account-create-footer"><button type="button" onClick={() => setAddingAdminAccount(false)} className="account-create-cancel">Kanselahin</button><button type="submit" className="account-create-submit"><Plus size={17} /> Gumawa ng Admin Account</button></footer>
        </form>
      </Modal>

      <Modal
        open={pendingResetId != null}
        onClose={() => {
          setPendingResetId(null)
          setResetPasswordValue('')
        }}
        title="I-update ang Password ng Admin"
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <p className="text-sm text-gray-500">
            Ilagay ang bagong password para sa account ni{' '}
            <strong className="text-gray-800">
              {accounts.find((a) => a.id === pendingResetId)?.name}
            </strong>.
          </p>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Bagong Password
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="hal. Barangay#1234"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
              <button
                type="button"
                onClick={() => setResetPasswordValue(generateTempPassword())}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                <Dices size={14} />
                Bumuo
              </button>
            </div>

            {/* Password Strength Status Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500 font-semibold">Kahirapan ng Password (Strength):</span>
                <span className={`font-bold ${getPasswordStrength(resetPasswordValue).textColor}`}>
                  {getPasswordStrength(resetPasswordValue).label || 'Walang nilalaman'}
                </span>
              </div>
              <div className="flex h-1.5 gap-1 rounded bg-gray-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    getPasswordStrength(resetPasswordValue).score >= 1
                      ? getPasswordStrength(resetPasswordValue).color
                      : 'bg-transparent'
                  }`}
                  style={{ width: '25%' }}
                />
                <div
                  className={`h-full transition-all duration-300 ${
                    getPasswordStrength(resetPasswordValue).score >= 2
                      ? getPasswordStrength(resetPasswordValue).color
                      : 'bg-transparent'
                  }`}
                  style={{ width: '25%' }}
                />
                <div
                  className={`h-full transition-all duration-300 ${
                    getPasswordStrength(resetPasswordValue).score >= 3
                      ? getPasswordStrength(resetPasswordValue).color
                      : 'bg-transparent'
                  }`}
                  style={{ width: '25%' }}
                />
                <div
                  className={`h-full transition-all duration-300 ${
                    getPasswordStrength(resetPasswordValue).score >= 4
                      ? getPasswordStrength(resetPasswordValue).color
                      : 'bg-transparent'
                  }`}
                  style={{ width: '25%' }}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-400 font-semibold leading-relaxed">
                * Ang password ay dapat mayroong hindi bababa sa 8 karakter at naglalaman ng kumbinasyon ng malalaki at maliliit na titik, numero, at mga espesyal na karakter.
              </p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setPendingResetId(null)
                setResetPasswordValue('')
              }}
              className="w-1/2 rounded-lg border border-gray-300 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Kanselahin
            </button>
            <button
              type="submit"
              className="w-1/2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-2.5 font-semibold text-white transition-all active:scale-[0.98]"
            >
              I-save
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Palitan ang Tungkulin ng Admin */}
      <Modal
        open={editingRoleAdmin != null}
        onClose={() => {
          setEditingRoleAdmin(null)
          setSelectedNewRole('')
          setSelectedCommitteeId('')
        }}
        title="Palitan ang Tungkulin ng Admin"
      >
        {editingRoleAdmin && (
          <form onSubmit={handleAdminRoleChangeSubmit} className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{editingRoleAdmin.name}</p>
                  <p className="text-xs text-gray-500">{editingRoleAdmin.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-gray-400 block mb-0.5">Kasalukuyan:</span>
                  <Pill color="blue" solid={false}>{roleDisplayName(editingRoleAdmin.role)}</Pill>
                </div>
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Pumili ng Bagong Tungkulin
              </span>
              <select
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {PORTAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r} {r === editingRoleAdmin.role ? '(Kasalukuyan)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedNewRole === ROLES.KAGAWAD && <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Assigned Committee</span>
              <select required value={selectedCommitteeId} onChange={(e) => setSelectedCommitteeId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue">
                <option value="">Pumili ng komite</option>
                {(committees || []).map((committee) => <option key={committee.committee_id} value={committee.committee_id}>{committee.committee_id} — {committee.committee_name}</option>)}
              </select>
              <small className="mt-1 block text-xs text-gray-500">Committee ID ang gagamitin sa pag-filter ng dashboard, GIS, at complaints.</small>
            </label>}

            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-700 leading-relaxed">
              * Ang pagpapalit ng tungkulin ay magbabago sa mga module at permissions na maaaring ma-access ng admin na ito sa Command Center.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingRoleAdmin(null)
                  setSelectedNewRole('')
                  setSelectedCommitteeId('')
                }}
                className="w-1/2 rounded-lg border border-gray-300 py-2.5 font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Kanselahin
              </button>
              <button
                type="submit"
                disabled={!selectedNewRole || (selectedNewRole === ROLES.KAGAWAD && !selectedCommitteeId) || (selectedNewRole === editingRoleAdmin.role && String(editingRoleAdmin.committeeId || '') === String(selectedCommitteeId || ''))}
                className="w-1/2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-2.5 font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                I-save ang Tungkulin
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingModuleToggle != null}
        onClose={() => setPendingModuleToggle(null)}
        onConfirm={confirmModuleToggle}
        title={pendingModuleToggle?.enabled ? 'I-on ang Module' : 'I-off ang Module'}
        message={
          pendingModuleToggle
            ? pendingModuleToggle.enabled
              ? `Sigurado ka bang gusto mong i-on ang "${pendingModuleToggle.moduleLabel}" para sa tungkulin na ${pendingModuleToggle.role}? Makikita na nila ito sa sidebar at magkakaroon sila ng access dito.`
              : `Sigurado ka bang gusto mong i-off ang "${pendingModuleToggle.moduleLabel}" para sa tungkulin na ${pendingModuleToggle.role}? Mawawala ito sa sidebar nila at hindi na nila maaring ma-access ang module na ito.`
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
        title={pendingStatusUser && pendingStatusActionMeta ? pendingStatusActionMeta.confirmTitle : ''}
        message={
          pendingStatusUser && pendingStatusActionMeta
            ? pendingStatusActionMeta.confirmMessage(pendingStatusUser.name || pendingStatusUser.fullName)
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
            ? `Sigurado ka bang gusto mong gawing ${pendingRoleAssignment.role} si ${
                pendingRoleAssignment.targetUser.name || pendingRoleAssignment.targetUser.fullName
              }? ${
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
              ? `Sigurado ka bang gusto mong aprubahan na gawing ${
                  pendingRoleDecision.targetUser.pendingRoleRequest?.requestedRole
                } si ${pendingRoleDecision.targetUser.name || pendingRoleDecision.targetUser.fullName}?`
              : `Sigurado ka bang gusto mong tanggihan ang kahilingan sa tungkulin ni ${
                  pendingRoleDecision.targetUser.name || pendingRoleDecision.targetUser.fullName
                }?`
            : ''
        }
        confirmLabel={pendingRoleDecision?.decision === 'approve' ? 'Aprubahan' : 'Tanggihan'}
        danger={pendingRoleDecision?.decision === 'reject'}
      />
    </div>
  )
}
