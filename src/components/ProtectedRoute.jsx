import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (!user) return <Navigate to="/login" replace />

  // Enforce Two-Factor Authentication (2FA) status check
  const is2faVerified = sessionStorage.getItem('2fa_verified') === 'true'
  if (!is2faVerified && pathname !== '/2fa') {
    return <Navigate to="/2fa" replace />
  }

  // Redirect to dashboard if already verified and visiting 2fa page
  if (is2faVerified && pathname === '/2fa') {
    return <Navigate to="/dashboard" replace />
  }

  if (user.mustChangePassword && pathname !== '/first-login') {
    return <Navigate to="/first-login" replace />
  }
  return children
}
