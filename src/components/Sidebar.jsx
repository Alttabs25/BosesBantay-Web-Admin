import { NavLink } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const { addAuditEntry, hasDynamicModuleAccess } = useData()

  const visibleItems = NAV_ITEMS.filter((item) => hasDynamicModuleAccess(user?.role, item.module))

  const handleLogout = () => {
    addAuditEntry('Logout', { color: 'blue' })
    logout()
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-[1100] bg-black/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[1200] flex h-full w-64 shrink-0 -translate-x-full flex-col bg-bb-navy text-white transition-transform duration-200 ease-in-out print:hidden lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-6">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.png" alt="BosesBantay logo" className="h-10 w-10 object-contain" />
            <span className="text-sm font-bold tracking-wide">BOSESBANTAY</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white text-bb-navy font-semibold'
                    : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-red-600 py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>
    </>
  )
}
