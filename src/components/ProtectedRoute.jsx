import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const { pathname } = useLocation()

  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword && pathname !== '/first-login') {
    return <Navigate to="/first-login" replace />
  }
  return children
}
