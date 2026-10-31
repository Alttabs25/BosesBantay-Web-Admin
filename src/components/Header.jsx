import { Link, useLocation } from 'react-router-dom'
import { Menu, User, ChevronRight } from 'lucide-react'
import { NAV_ITEMS } from '../config/navigation'
import { useAuth } from '../context/AuthContext'
import './Header.css'

export default function Header({onMenuClick}) {
  const {pathname}=useLocation()
  const {user}=useAuth()
  const current=NAV_ITEMS.find(item=>pathname===item.path||pathname.startsWith(item.path+'/'))
  return <header className="admin-page-header print:hidden">
    <div className="admin-header-heading"><button type="button" className="admin-menu-button" onClick={onMenuClick} aria-label="Open navigation"><Menu size={22}/></button><div className="admin-header-titles"><div className="admin-header-context"><span>{current?.group||'Administration'}</span></div><h1>{current?.headerTitle||'Administration'}</h1></div></div>
    <Link to="/profile" className="admin-header-account" aria-label={`Open profile for ${user?.name||'your account'}`}><span className="admin-header-avatar">{user?.avatarUrl?<img src={user.avatarUrl} alt=""/>:<User size={21}/>}</span><span className="admin-header-user"><strong>{user?.name||'Your account'}</strong><span>{user?.role||'Barangay staff'}</span></span><ChevronRight className="admin-account-chevron" size={15} aria-hidden="true"/></Link>
  </header>
}
