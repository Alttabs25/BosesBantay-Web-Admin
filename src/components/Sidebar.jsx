import { NavLink } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
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
        className={`fixed inset-y-0 left-0 z-[1200] flex h-full shrink-0 -translate-x-full flex-col bg-bb-navy text-white transition-all duration-300 ease-in-out print:hidden lg:static lg:z-auto lg:translate-x-0 ${
          collapsed ? 'w-20 lg:w-[76px]' : 'w-64 lg:w-64'
        } ${open ? 'translate-x-0' : ''}`}
      >
        <div className={`flex items-center gap-3 px-4 py-6 ${collapsed ? 'lg:justify-center' : 'justify-between px-6'}`}>
          <button
            onClick={onToggleCollapse}
            className="flex items-center gap-3 hover:opacity-85 transition-opacity focus:outline-none cursor-pointer"
            title={collapsed ? "I-expand ang sidebar" : "I-collapse ang sidebar"}
          >
            <img src="/logo-icon.png" alt="BosesBantay logo" className="h-10 w-10 object-contain shrink-0" />
            {!collapsed && (
              <span className="text-sm font-bold tracking-wide transition-opacity duration-300">BOSESBANTAY</span>
            )}
          </button>
          {!collapsed && (
            <button onClick={onClose} className="text-white/70 hover:text-white lg:hidden">
              <X size={20} />
            </button>
          )}
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto ${collapsed ? 'lg:px-2' : 'px-3'}`}>
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : 'px-3'} ${
                  isActive
                    ? 'bg-white text-bb-navy font-semibold'
                    : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="truncate transition-opacity duration-300">{label}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={`p-4 ${collapsed ? 'lg:p-2' : ''}`}>
          <button
            onClick={handleLogout}
            title={collapsed ? "Mag-log out" : undefined}
            className={`flex items-center justify-center rounded-lg bg-gradient-to-b from-red-600 to-red-700/90 border border-red-600/10 shadow-sm hover:shadow hover:from-red-700 hover:to-red-800 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] ${collapsed ? 'w-full lg:px-0 lg:gap-0' : 'w-full gap-2'}`}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && (
              <span className="truncate transition-opacity duration-300">Log out</span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
