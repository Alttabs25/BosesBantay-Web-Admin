// Role names must match exactly what Login.jsx writes to AuthContext's user.role.
export const ROLES = {
  SECRETARY: 'Barangay Secretary',
  TANOD: 'Tanod / BPSO',
  LUPON: 'Lupon Member',
  KAGAWAD: 'Kagawad (Committee Chair)',
  CAPTAIN: 'Barangay Captain', // Punong Barangay
  ADMIN: 'System Administrator',
}

const { SECRETARY, TANOD, LUPON, KAGAWAD, CAPTAIN, ADMIN } = ROLES

// moduleKey -> role -> capability list. Empty/absent array = no access at all.
export const PERMISSIONS = {
  dashboard: {
    [SECRETARY]: ['read'],
    [TANOD]: ['read'],
    [LUPON]: ['read'],
    [KAGAWAD]: ['read'],
    [CAPTAIN]: ['read'],
    [ADMIN]: ['read'],
  },
  gis: {
    [SECRETARY]: ['create', 'read', 'update'],
    [TANOD]: ['create', 'read'],
    [LUPON]: [],
    [KAGAWAD]: ['read'],
    [CAPTAIN]: ['read', 'update'],
    [ADMIN]: ['read'],
  },
  blotter: {
    [SECRETARY]: ['read', 'update', 'confirm'],
    [TANOD]: [],
    [LUPON]: ['read', 'update'],
    [KAGAWAD]: [],
    [CAPTAIN]: ['read', 'update', 'confirm'],
    [ADMIN]: ['read'],
  },
  userAccounts: {
    [SECRETARY]: [],
    [TANOD]: [],
    [LUPON]: [],
    [KAGAWAD]: [],
    [CAPTAIN]: ['read', 'approve'],
    [ADMIN]: ['create', 'read', 'update', 'delete'],
  },
  knowledgeBase: {
    [SECRETARY]: ['create', 'read', 'update'],
    [TANOD]: [],
    [LUPON]: [],
    [KAGAWAD]: [],
    [CAPTAIN]: ['read', 'approve'],
    [ADMIN]: ['read', 'create', 'update', 'delete'],
  },
  alerts: {
    [SECRETARY]: ['create', 'read'],
    [TANOD]: ['read'],
    [LUPON]: [],
    [KAGAWAD]: ['create', 'read'],
    [CAPTAIN]: ['create', 'read'],
    [ADMIN]: ['create', 'read'],
  },
  auditLogs: {
    [SECRETARY]: [],
    [TANOD]: [],
    [LUPON]: [],
    [KAGAWAD]: [],
    [CAPTAIN]: ['read'],
    [ADMIN]: ['read'],
  },
  reports: {
    [SECRETARY]: ['create', 'read'],
    [TANOD]: [],
    [LUPON]: ['read'],
    [KAGAWAD]: ['read'],
    [CAPTAIN]: ['create', 'read'],
    [ADMIN]: ['read'],
  },
  profile: {
    [SECRETARY]: ['read', 'update'],
    [TANOD]: ['read', 'update'],
    [LUPON]: ['read', 'update'],
    [KAGAWAD]: ['read', 'update'],
    [CAPTAIN]: ['read', 'update'],
    [ADMIN]: ['read', 'update'],
  },
}

// Roles that require Punong Barangay sign-off before an Admin-assigned role
// change actually takes effect (per spec: "official and committee-level roles").
export const ROLES_REQUIRING_PB_APPROVAL = [SECRETARY, KAGAWAD, LUPON, CAPTAIN]

export function can(role, moduleKey, action) {
  return Boolean(PERMISSIONS[moduleKey]?.[role]?.includes(action))
}

export function hasModuleAccess(role, moduleKey) {
  return Boolean(PERMISSIONS[moduleKey]?.[role]?.length)
}

// Modules the System Administrator can toggle on/off per role. Dashboard and
// Profile are deliberately excluded — every role needs a guaranteed landing
// page and account/password access, so they stay always-on to avoid a role
// being locked out of the portal entirely.
export const ASSIGNABLE_MODULES = [
  { key: 'gis', label: 'GIS Command Center' },
  { key: 'blotter', label: 'Digital Blotter' },
  { key: 'userAccounts', label: 'User Accounts' },
  { key: 'knowledgeBase', label: 'Knowledge Base' },
  { key: 'alerts', label: 'In-App notification' },
  { key: 'reports', label: 'Reports' },
  { key: 'auditLogs', label: 'Audit Logs' },
]

// Roles whose module access the System Administrator can reassign. ADMIN is
// excluded so the System Administrator can never toggle away their own access.
export const ASSIGNABLE_MODULE_ROLES = [SECRETARY, TANOD, LUPON, KAGAWAD, CAPTAIN]

// Modules that are always visible/accessible regardless of any per-role override.
export const ALWAYS_ON_MODULES = ['dashboard', 'profile']

export function defaultModuleAccessMap() {
  const map = {}
  ASSIGNABLE_MODULE_ROLES.forEach((role) => {
    map[role] = {}
    ASSIGNABLE_MODULES.forEach(({ key }) => {
      map[role][key] = hasModuleAccess(role, key)
    })
  })
  return map
}
