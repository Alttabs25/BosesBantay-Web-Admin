import { useMemo, useState } from 'react'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import { useData } from '../context/DataContext'

export default function AuditLogs() {
  const { auditLog } = useData()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return auditLog
    return auditLog.filter(
      (log) =>
        log.actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.actorRole.toLowerCase().includes(q),
    )
  }, [auditLog, query])

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
      <p className="mt-1 text-sm text-gray-500">Read only compliance tracking</p>

      <div className="mt-4 max-w-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Hanapin sa log..."
        />
      </div>

      <div className="mt-4 max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Pangalan</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Petsa &amp; Oras</th>
              <th className="px-4 py-3 font-semibold">Aksyon</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-700">{log.actorName}</td>
                <td className="px-4 py-3 text-gray-500">{log.actorRole}</td>
                <td className="px-4 py-3 text-gray-500">{log.timestamp}</td>
                <td className="px-4 py-3">
                  <Pill color={log.color} solid>
                    {log.action}
                  </Pill>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                  Walang nahanap na log entry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
