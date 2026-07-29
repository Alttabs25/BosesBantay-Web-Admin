import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, User, ChevronDown, UserCircle, LogOut } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { addAuditEntry } = useData()
  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.path))
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 bg-bb-blue px-4 text-white print:hidden sm:h-20 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="shrink-0 rounded-lg p-1 hover:bg-white/10 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="truncate text-lg font-bold sm:text-2xl">{current?.headerTitle ?? ''}</h1>
      </div>

      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-3 rounded-full py-1 pl-2 pr-1 hover:bg-white/10 sm:pr-2"
        >
          <div className="hidden text-right leading-tight sm:block">
            <p className="font-semibold">{user?.name}</p>
            <p className="text-sm text-white/75">{user?.role}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 sm:h-11 sm:w-11">
            <User size={20} />
          </div>
          <ChevronDown
            size={16}
            className={`hidden shrink-0 transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg bg-white text-gray-700 shadow-xl">
            <div className="border-b border-gray-100 px-4 py-3 sm:hidden">
              <p className="font-semibold text-gray-900">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.role}</p>
            </div>
            <Link
              to="/profile"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-bb-blue-light"
            >
              <UserCircle size={16} />
              Profile Management
            </Link>
            <button
              onClick={() => {
                addAuditEntry('Logout', { color: 'blue' })
                logout()
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
