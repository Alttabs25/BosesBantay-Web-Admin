import {
  LayoutDashboard,
  MapPin,
  ClipboardList,
  MessageSquareWarning,
  Users,
  Bell,
  ShieldCheck,
  FileBarChart,
  UserCircle,
  Phone,
  Bot,
  Server,
} from 'lucide-react'

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', group: 'Workspace', icon: LayoutDashboard, headerTitle: 'Dashboard', module: 'dashboard' },
  { label: 'GIS Command Center', path: '/gis', group: 'Workspace', icon: MapPin, headerTitle: 'GIS Command Center', module: 'gis' },
  { label: 'Service Complaints', path: '/complaints', group: 'Workspace', icon: MessageSquareWarning, headerTitle: 'Service Complaints', module: 'blotter' },
  { label: 'Blotter Reports', path: '/blotter', group: 'Workspace', icon: ClipboardList, headerTitle: 'Blotter Reports', module: 'blotter' },
  { label: 'User Accounts', path: '/accounts', group: 'Management', icon: Users, headerTitle: 'User Accounts', module: 'userAccounts' },
  { label: 'Barangay Bot', path: '/knowledge-base', group: 'Management', icon: Bot, headerTitle: 'Barangay Bot', module: 'knowledgeBase' },
  { label: 'Services', path: '/services', group: 'Management', icon: Server, headerTitle: 'Service Controls', module: 'knowledgeBase' },
  { label: 'Emergency Directory', path: '/directory', group: 'Management', icon: Phone, headerTitle: 'Emergency Directory', module: 'directory' },
  { label: 'In-App notification', path: '/alerts', group: 'Management', icon: Bell, headerTitle: 'Alert Broadcast', module: 'alerts' },
  { label: 'Reports', path: '/reports', group: 'Reports & account', icon: FileBarChart, headerTitle: 'Reports and Records Generation', module: 'reports' },
  { label: 'Audit', path: '/audit', group: 'Reports & account', icon: ShieldCheck, headerTitle: 'Audit Logs Admin', module: 'auditLogs' },
  { label: 'Profile Management', path: '/profile', group: 'Reports & account', icon: UserCircle, headerTitle: 'Profile', module: 'profile' },
]
