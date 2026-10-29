import { NavLink } from 'react-router-dom'
import { ChevronLeft, LogOut, X } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
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
        className={`bb-sidebar fixed inset-y-0 left-0 z-[1200] flex h-full shrink-0 -translate-x-full flex-col bg-bb-navy text-white print:hidden lg:static lg:z-auto lg:translate-x-0 ${
          collapsed ? 'w-64 lg:w-[76px]' : 'w-64'
        } ${collapsed ? 'is-collapsed' : ''} ${open ? 'translate-x-0' : ''}`}
      >
        <div className="bb-sidebar-header flex items-center justify-between gap-2 px-4 py-6">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/logo-icon.png" alt="BosesBantay logo" className="bb-sidebar-logo h-10 w-10 shrink-0 object-contain" />
            <span className="bb-sidebar-label bb-sidebar-brand truncate text-sm font-bold tracking-wide">BOSESBANTAY</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-lg border border-white/20 p-1.5 text-white/85 transition-colors hover:bg-white/10 hover:text-white lg:flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'I-expand ang menu' : 'I-collapse ang menu'}
            >
              <ChevronLeft size={18} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="text-white/70 hover:text-white lg:hidden" aria-label="Close menu">
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="bb-sidebar-nav flex-1 space-y-1 overflow-y-auto px-3">
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={({ isActive }) =>
                `bb-sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white text-bb-navy font-semibold'
                    : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="bb-sidebar-label truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="bb-sidebar-footer p-4">
          <button
            onClick={handleLogout}
            title={collapsed ? "Mag-log out" : undefined}
            className="bb-sidebar-logout flex w-full items-center justify-center gap-2 rounded-lg border border-red-600/10 bg-gradient-to-b from-red-600 to-red-700/90 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-red-700 hover:to-red-800 hover:shadow active:scale-[0.98]"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="bb-sidebar-label truncate">Log out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
