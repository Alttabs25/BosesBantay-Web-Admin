import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function RoleGuard({ module, children }) {
  const { user } = useAuth()
  const { hasDynamicModuleAccess } = useData()
  if (!user || !hasDynamicModuleAccess(user.role, module)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
