import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// Mock accounts only — no backend wired up yet. Passwords live in plain
// state for demo purposes; a real backend would hash + never expose these.
const SEED_ACCOUNTS = [
  {
    id: 'ADM-001',
    name: 'Justine Bryant',
    role: 'Barangay Captain',
    email: 'captain.justine@quezoncity.gov.ph',
    password: 'password123',
    mustChangePassword: false,
  },
  {
    id: 'ADM-002',
    name: 'Ma. Ana Villanueva',
    role: 'Barangay Secretary',
    email: 'secretary.ana@quezoncity.gov.ph',
    password: 'password123',
    mustChangePassword: false,
  },
  {
    id: 'ADM-003',
    name: 'Carlo B. Ramos',
    role: 'Tanod / BPSO',
    email: 'tanod.carlo@quezoncity.gov.ph',
    password: 'password123',
    mustChangePassword: false,
  },
  {
    id: 'ADM-004',
    name: 'Rosario Dimaguila',
    role: 'Lupon Member',
    email: 'lupon.rosario@quezoncity.gov.ph',
    password: 'password123',
    mustChangePassword: false,
  },
  {
    id: 'ADM-005',
    name: 'Miguel Santos',
    role: 'Kagawad (Committee Chair)',
    email: 'kagawad.miguel@quezoncity.gov.ph',
    password: 'password123',
    mustChangePassword: false,
  },
  {
    id: 'ADM-006',
    name: 'Patricia Reyes',
    role: 'System Administrator',
    email: 'admin.patricia@quezoncity.gov.ph',
    password: 'password123',
    mustChangePassword: false,
  },
  {
    id: 'ADM-007',
    name: 'Ramon Villanueva',
    role: 'Tanod / BPSO',
    email: 'ramon.villanueva@quezoncity.gov.ph',
    password: 'Barangay#2026',
    mustChangePassword: true,
  },
]

function nextAdminId(accounts) {
  const max = accounts.reduce((acc, a) => {
    const n = parseInt(a.id.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(acc, n) : acc
  }, 0)
  return `ADM-${String(max + 1).padStart(3, '0')}`
}

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState(SEED_ACCOUNTS)
  const [user, setUser] = useState(null)
  const [pendingResets, setPendingResets] = useState({})

  const login = ({ email, password }) => {
    const normalized = email.trim().toLowerCase()
    const account = accounts.find((a) => a.email.toLowerCase() === normalized)
    if (!account || account.password !== password) {
      return { success: false }
    }
    const nextUser = {
      id: account.id,
      name: account.name,
      role: account.role,
      email: account.email,
      mustChangePassword: account.mustChangePassword,
    }
    setUser(nextUser)
    return { success: true, user: nextUser }
  }

  const logout = () => setUser(null)

  const updateUser = (partial) => {
    if (!user) return
    setUser((prev) => (prev ? { ...prev, ...partial } : prev))
    setAccounts((prev) => prev.map((a) => (a.id === user.id ? { ...a, ...partial } : a)))
  }

  const changePassword = ({ currentPassword, newPassword }) => {
    if (!user) return { success: false, error: 'not-authenticated' }
    const account = accounts.find((a) => a.id === user.id)
    if (!account || account.password !== currentPassword) {
      return { success: false, error: 'invalid-current' }
    }
    setAccounts((prev) =>
      prev.map((a) => (a.id === user.id ? { ...a, password: newPassword, mustChangePassword: false } : a)),
    )
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev))
    return { success: true }
  }

  const completeFirstLogin = (newPassword) => {
    if (!user) return { success: false }
    setAccounts((prev) =>
      prev.map((a) => (a.id === user.id ? { ...a, password: newPassword, mustChangePassword: false } : a)),
    )
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev))
    return { success: true }
  }

  const createAdminAccount = ({ name, email, role, tempPassword }) => {
    const normalized = email.trim().toLowerCase()
    if (accounts.some((a) => a.email.toLowerCase() === normalized)) {
      return { success: false, error: 'duplicate-email' }
    }
    const newAccount = {
      id: nextAdminId(accounts),
      name: name.trim(),
      email: email.trim(),
      role,
      password: tempPassword,
      mustChangePassword: true,
    }
    setAccounts((prev) => [...prev, newAccount])
    return { success: true, account: newAccount }
  }

  const resetAdminAccountPassword = (accountId, newTempPassword) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, password: newTempPassword, mustChangePassword: true } : a,
      ),
    )
  }

  const deleteAdminAccount = (accountId) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }

  // Always looks like it succeeded from the caller's perspective (no account
  // enumeration) — only actually creates a pending reset when the email is real.
  const requestPasswordReset = (email) => {
    const normalized = email.trim().toLowerCase()
    const account = accounts.find((a) => a.email.toLowerCase() === normalized)
    if (!account) return { found: false }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setPendingResets((prev) => ({ ...prev, [normalized]: { code, accountId: account.id } }))
    return { found: true, code }
  }

  const resetPasswordWithCode = ({ email, code, newPassword }) => {
    const normalized = email.trim().toLowerCase()
    const pending = pendingResets[normalized]
    if (!pending || pending.code !== code.trim()) {
      return { success: false }
    }
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === pending.accountId ? { ...a, password: newPassword, mustChangePassword: false } : a,
      ),
    )
    setPendingResets((prev) => {
      const next = { ...prev }
      delete next[normalized]
      return next
    })
    return { success: true }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accounts,
        login,
        logout,
        updateUser,
        changePassword,
        completeFirstLogin,
        createAdminAccount,
        resetAdminAccountPassword,
        deleteAdminAccount,
        requestPasswordReset,
        resetPasswordWithCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
