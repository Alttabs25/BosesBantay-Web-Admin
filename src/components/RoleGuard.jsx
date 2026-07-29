import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasModuleAccess } from '../config/permissions'

export default function RoleGuard({ module, children }) {
  const { user } = useAuth()
  if (!user || !hasModuleAccess(user.role, module)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
