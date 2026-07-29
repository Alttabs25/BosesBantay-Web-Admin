import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

// Mock session only — no backend wired up yet.
const MOCK_ADMIN = {
  name: 'Justine Bryant',
  role: 'Barangay Captain',
  email: 'captain.justine@quezoncity.gov.ph',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const login = ({ role }) => {
    const nextUser = { ...MOCK_ADMIN, role: role || MOCK_ADMIN.role }
    setUser(nextUser)
    return nextUser
  }

  const logout = () => setUser(null)

  const updateUser = (partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
