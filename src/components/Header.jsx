import { Link, useLocation } from 'react-router-dom'
import { Menu, User } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'
import { useAuth } from '../context/AuthContext'

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.path))

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

      <div className="min-w-0 shrink-0">
        <Link
          to="/profile"
          className="flex min-w-0 items-center gap-2 rounded-lg py-1 pl-2 pr-1 hover:bg-white/10 sm:gap-3 sm:pr-2"
        >
          <div className="min-w-0 text-right leading-tight">
            <p className="whitespace-nowrap text-xs font-semibold sm:text-base">{user?.name}</p>
            <p className="whitespace-nowrap text-[10px] text-white/75 sm:text-sm">{user?.role}</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 sm:h-11 sm:w-11">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user?.name} className="h-full w-full object-cover" />
            ) : (
              <User size={20} />
            )}
          </div>
        </Link>
      </div>
    </header>
  )
}
