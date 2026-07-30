import { createContext, useContext, useState } from 'react'
import { useAuth } from './AuthContext'
import { MOCK_USERS } from '../data/mockUsers'
import { MOCK_INCIDENTS } from '../data/mockIncidents'
import { MOCK_BLOTTER } from '../data/mockBlotter'
import { MOCK_DOCUMENTS } from '../data/mockDocuments'
import { MOCK_AUDIT_LOGS } from '../data/mockAuditLogs'
import {
  ROLES,
  ALWAYS_ON_MODULES,
  ASSIGNABLE_MODULE_ROLES,
  defaultModuleAccessMap,
  hasModuleAccess,
} from '../config/permissions'

const DataContext = createContext(null)

function seedUsers() {
  return MOCK_USERS.map((u) => ({ ...u, pendingRoleRequest: null }))
}

function seedAuditLog() {
  return MOCK_AUDIT_LOGS.map((log, i) => ({
    id: `seed-${i}`,
    actorName: log.name,
    actorRole: log.role,
    action: log.action,
    timestamp: log.datetime,
    color: log.color,
  }))
}

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [users, setUsers] = useState(seedUsers)
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS)
  const [blotterReports, setBlotterReports] = useState(MOCK_BLOTTER)
  const [documents, setDocuments] = useState(MOCK_DOCUMENTS)
  const [alertHistory, setAlertHistory] = useState([])
  const [auditLog, setAuditLog] = useState(seedAuditLog)
  const [roleModuleAccess, setRoleModuleAccess] = useState(defaultModuleAccessMap)

  const addAuditEntry = (action, { color = 'blue', actorName, actorRole } = {}) => {
    setAuditLog((prev) => [
      {
        id: Date.now() + Math.random(),
        actorName: actorName ?? user?.name ?? 'System',
        actorRole: actorRole ?? user?.role ?? '—',
        action,
        timestamp: new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
        color,
      },
      ...prev,
    ])
  }

  const updateUser = (id, patch) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  const addUser = (newUser) => setUsers((prev) => [...prev, newUser])
  const removeUser = (id) => setUsers((prev) => prev.filter((u) => u.id !== id))

  const suspendUserByName = (name) => {
    setUsers((prev) => prev.map((u) => (u.name === name ? { ...u, status: 'Suspended' } : u)))
  }

  const addIncident = (incident) => setIncidents((prev) => [...prev, incident])
  const replaceIncident = (ref, record) =>
    setIncidents((prev) => prev.map((i) => (i.ref === ref ? record : i)))

  const updateBlotterReport = (id, patch) =>
    setBlotterReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const addDocument = (doc) => setDocuments((prev) => [doc, ...prev])
  const updateDocument = (title, patch) =>
    setDocuments((prev) => prev.map((d) => (d.title === title ? { ...d, ...patch } : d)))

  const addAlert = (entry) => setAlertHistory((prev) => [entry, ...prev])

  const setModuleAccess = (role, moduleKey, enabled) => {
    if (!ASSIGNABLE_MODULE_ROLES.includes(role)) return
    setRoleModuleAccess((prev) => ({
      ...prev,
      [role]: { ...prev[role], [moduleKey]: enabled },
    }))
  }

  const hasDynamicModuleAccess = (role, moduleKey) => {
    if (ALWAYS_ON_MODULES.includes(moduleKey)) return true
    if (role === ROLES.ADMIN) return hasModuleAccess(role, moduleKey)
    const override = roleModuleAccess[role]?.[moduleKey]
    if (override !== undefined) return override
    return hasModuleAccess(role, moduleKey)
  }

  return (
    <DataContext.Provider
      value={{
        users,
        updateUser,
        addUser,
        removeUser,
        suspendUserByName,
        incidents,
        addIncident,
        replaceIncident,
        blotterReports,
        updateBlotterReport,
        documents,
        addDocument,
        updateDocument,
        alertHistory,
        addAlert,
        auditLog,
        addAuditEntry,
        roleModuleAccess,
        setModuleAccess,
        hasDynamicModuleAccess,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
