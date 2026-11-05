// Canonical role names. Older database aliases are normalized at the auth boundary.
export const ROLES = Object.freeze({
  SECRETARY: 'Barangay Secretary',
  TANOD: 'Tanod / BPSO',
  LUPON: 'Lupong Tagapamayapa Member',
  KAGAWAD: 'Sangguniang Barangay Kagawad',
  CAPTAIN: 'Punong Barangay (Barangay Captain)',
  ADMIN: 'System Administrator',
})

const ROLE_ALIASES = Object.freeze({
  'Barangay Secretary': ROLES.SECRETARY,
  'Tanod / BPSO': ROLES.TANOD,
  'Tanod/BPSO': ROLES.TANOD,
  'Lupon Member': ROLES.LUPON,
  'Lupong Tagapamayapa Member': ROLES.LUPON,
  Kagawad: ROLES.KAGAWAD,
  'Kagawad (Committee Chair)': ROLES.KAGAWAD,
  'Sangguniang Barangay Kagawad': ROLES.KAGAWAD,
  'Barangay Captain': ROLES.CAPTAIN,
  'Punong Barangay': ROLES.CAPTAIN,
  'Punong Barangay (Barangay Captain)': ROLES.CAPTAIN,
  'System Admin': ROLES.ADMIN,
  'System Administrator': ROLES.ADMIN,
})

export function normalizeRole(role) {
  return ROLE_ALIASES[String(role || '').trim()] || String(role || '').trim()
}

export function roleDisplayName(role) {
  const normalized = normalizeRole(role)
  return normalized === ROLES.KAGAWAD ? 'Barangay Kagawad' : normalized
}

export function roleLookupNames(role) {
  const canonical = normalizeRole(role)
  return [...new Set(Object.entries(ROLE_ALIASES)
    .filter(([, value]) => value === canonical)
    .map(([name]) => name))]
}

const { SECRETARY, TANOD, LUPON, KAGAWAD, CAPTAIN, ADMIN } = ROLES

// Module visibility and operations share one source of truth.
export const PERMISSIONS = Object.freeze({
  dashboard: {
    [SECRETARY]: ['read'], [TANOD]: ['read'], [LUPON]: ['read'],
    [KAGAWAD]: ['read'], [CAPTAIN]: ['read'], [ADMIN]: ['read'],
  },
  gis: {
    [SECRETARY]: ['create', 'read', 'update'], [TANOD]: ['create', 'read'],
    [KAGAWAD]: ['read'], [CAPTAIN]: ['read', 'update'],
    [ADMIN]: ['create', 'read', 'update', 'delete', 'approve'],
  },
  serviceComplaints: {
    [SECRETARY]: ['create', 'read', 'update'], [TANOD]: ['create', 'read'],
    [KAGAWAD]: ['read'], [CAPTAIN]: ['read'],
    [ADMIN]: ['create', 'read', 'update', 'delete', 'approve'],
  },
  blotter: {
    [SECRETARY]: ['read', 'update', 'confirm', 'finalize'],
    [TANOD]: ['create', 'read'], [LUPON]: ['read', 'update'],
    [CAPTAIN]: ['read', 'update', 'confirm', 'finalize'],
    [ADMIN]: ['create', 'read', 'update', 'delete', 'confirm', 'finalize'],
  },
  userAccounts: {
    [SECRETARY]: ['read', 'verify'], [CAPTAIN]: ['read', 'approve', 'assignRole'],
    [ADMIN]: ['create', 'read', 'update', 'delete', 'approve', 'assignRole'],
  },
  knowledgeBase: {
    [SECRETARY]: ['create', 'read', 'update'], [CAPTAIN]: ['read', 'approve'],
    [ADMIN]: ['create', 'read', 'update', 'delete', 'approve'],
  },
  // Preserve the existing System Administrator's Services access.
  services: { [ADMIN]: ['create', 'read', 'update', 'delete'] },
  directory: {
    [SECRETARY]: ['read'], [TANOD]: ['read'], [LUPON]: ['read'],
    [KAGAWAD]: ['read'], [CAPTAIN]: ['read', 'update', 'approve'],
    [ADMIN]: ['create', 'read', 'update', 'delete'],
  },
  alerts: {
    [SECRETARY]: ['create', 'read'], [TANOD]: ['read'], [LUPON]: ['read'],
    [KAGAWAD]: ['read'], [CAPTAIN]: ['create', 'read'],
    [ADMIN]: ['create', 'read', 'delete'],
  },
  reports: {
    [SECRETARY]: ['create', 'read', 'export'], [LUPON]: ['read'],
    [KAGAWAD]: ['read'], [CAPTAIN]: ['create', 'read', 'export'],
    [ADMIN]: ['create', 'read', 'export'],
  },
  auditLogs: { [CAPTAIN]: ['read'], [ADMIN]: ['read'] },
  profile: {
    [SECRETARY]: ['read', 'update'], [TANOD]: ['read', 'update'],
    [LUPON]: ['read', 'update'], [KAGAWAD]: ['read', 'update'],
    [CAPTAIN]: ['read', 'update'], [ADMIN]: ['read', 'update'],
  },
})

export const ROLES_REQUIRING_PB_APPROVAL = [SECRETARY, KAGAWAD, LUPON, CAPTAIN]

export function can(role, moduleKey, action) {
  return Boolean(PERMISSIONS[moduleKey]?.[normalizeRole(role)]?.includes(action))
}

export function hasModuleAccess(role, moduleKey) {
  return Boolean(PERMISSIONS[moduleKey]?.[normalizeRole(role)]?.length)
}

export const ASSIGNABLE_MODULES = [
  { key: 'gis', label: 'GIS Command Center' },
  { key: 'serviceComplaints', label: 'Service Complaints' },
  { key: 'blotter', label: 'Blotter Reports' },
  { key: 'userAccounts', label: 'User Accounts' },
  { key: 'knowledgeBase', label: 'Barangay Bot' },
  { key: 'services', label: 'Services' },
  { key: 'directory', label: 'Emergency Directory' },
  { key: 'alerts', label: 'In-App Notification' },
  { key: 'reports', label: 'Reports' },
  { key: 'auditLogs', label: 'Audit' },
]

export const ASSIGNABLE_MODULE_ROLES = [SECRETARY, TANOD, LUPON, KAGAWAD, CAPTAIN]
export const ALWAYS_ON_MODULES = ['dashboard', 'profile']

export function defaultModuleAccessMap() {
  return Object.fromEntries(ASSIGNABLE_MODULE_ROLES.map(role => [
    role,
    Object.fromEntries(ASSIGNABLE_MODULES.map(({ key }) => [key, hasModuleAccess(role, key)])),
  ]))
}
