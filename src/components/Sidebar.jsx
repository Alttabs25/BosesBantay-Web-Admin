import './Sidebar.css'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth()
  const [helper, setHelper] = useState(null)
  const helperTimer = useRef(null)
  useEffect(() => () => clearTimeout(helperTimer.current), [])
  useEffect(() => { clearTimeout(helperTimer.current); setHelper(null) }, [collapsed, open])
  function showHelper(event, label, group = 'Account') {
    if (!collapsed || window.innerWidth < 1024) return
    const rect = event.currentTarget.getBoundingClientRect()
    clearTimeout(helperTimer.current)
    const nextHelper = { label, group, top: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height / 2)), left: rect.right + 14 }
    helperTimer.current = setTimeout(() => setHelper(nextHelper), event.type === 'focus' ? 0 : 180)
  }
  const hideHelper = () => { clearTimeout(helperTimer.current); setHelper(null) }
  const { addAuditEntry, hasDynamicModuleAccess } = useData()

  const visibleItems = NAV_ITEMS.filter((item) => hasDynamicModuleAccess(user?.role, item.module))

  const groupFor = path => ['/dashboard','/gis','/complaints','/blotter'].includes(path) ? 'Workspace' : ['/reports','/audit'].includes(path) ? 'Reports & activity' : path === '/profile' ? 'Account' : 'Management'
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
          <div className="bb-sidebar-brand-row flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
              aria-expanded={!collapsed}
              onMouseEnter={event => showHelper(event, 'Expand menu')}
              onMouseLeave={hideHelper}
              onFocus={event => showHelper(event, 'Expand menu')}
              onBlur={hideHelper}
              className="bb-sidebar-logo-button block shrink-0 rounded-lg"
            >
              <img src="/logo-icon.png" alt="BosesBantay logo" className="bb-sidebar-logo h-10 w-10 object-contain" />
            </button>
            <div className="bb-sidebar-label"><span className="bb-sidebar-brand block truncate text-sm font-bold tracking-wide">BOSESBANTAY</span></div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button type="button" onClick={onClose} className="text-white/70 hover:text-white lg:hidden" aria-label="Close menu">
              <X size={20} />
            </button>
          </div>
        </div>

        <nav onScroll={hideHelper} aria-label="Main navigation" className="bb-sidebar-nav flex-1 space-y-1 overflow-y-auto px-3">
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => { hideHelper(); onClose() }}
              onMouseEnter={event => showHelper(event, label, groupFor(path))} onMouseLeave={hideHelper}
              onFocus={event => showHelper(event, label, groupFor(path))} onBlur={hideHelper}
              aria-describedby={helper?.label === label ? 'sidebar-navigation-helper' : undefined}
              aria-label={label}
              className={({ isActive }) =>
                `bb-sidebar-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'is-active font-semibold'
                    : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <span className="bb-sidebar-icon"><Icon size={20} strokeWidth={1.75} /></span>
              <span className="bb-sidebar-label truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="bb-sidebar-footer p-4">
          <button
            onClick={handleLogout}
            onMouseEnter={event => showHelper(event, "Log out")} onMouseLeave={hideHelper} onFocus={event => showHelper(event, "Log out")} onBlur={hideHelper}
            className="bb-sidebar-logout flex w-full items-center gap-2 rounded-lg py-2.5 text-sm"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="bb-sidebar-label truncate">Log out</span>
          </button>
        </div>
      </aside>
      {helper && collapsed && createPortal(<div id="sidebar-navigation-helper" role="tooltip" className="bb-sidebar-helper" style={{ top: helper.top, left: helper.left }}><span className="bb-helper-label">{helper.label}</span></div>, document.body)}
    </>
  )
}
