import {
  LayoutDashboard,
  MapPin,
  Smartphone,
  Users,
  FolderOpen,
  Bell,
  ShieldCheck,
  FileBarChart,
  UserCircle,
} from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, headerTitle: 'Dashboard', module: 'dashboard' },
  { label: 'GIS Command Center', path: '/gis', icon: MapPin, headerTitle: 'Map', module: 'gis' },
  { label: 'Digital Blotter', path: '/blotter', icon: Smartphone, headerTitle: 'Blotter', module: 'blotter' },
  { label: 'User Accounts', path: '/accounts', icon: Users, headerTitle: 'User Accounts', module: 'userAccounts' },
  { label: 'Knowledge Base', path: '/knowledge-base', icon: FolderOpen, headerTitle: 'Document Management', module: 'knowledgeBase' },
  { label: 'In-App notification', path: '/alerts', icon: Bell, headerTitle: 'Alert Broadcast', module: 'alerts' },
  { label: 'Reports', path: '/reports', icon: FileBarChart, headerTitle: 'Reports and Records Generation', module: 'reports' },
  { label: 'Audit', path: '/audit', icon: ShieldCheck, headerTitle: 'Audit Logs Admin', module: 'auditLogs' },
  { label: 'Profile Management', path: '/profile', icon: UserCircle, headerTitle: 'Profile', module: 'profile' },
]
