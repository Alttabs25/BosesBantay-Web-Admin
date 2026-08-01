import { useMemo, useState, useEffect } from 'react'
import Pill from '../components/Pill'
import SearchInput from '../components/SearchInput'
import { useData } from '../context/DataContext'

export default function AuditLogs() {
  const { auditLog } = useData()
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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

  // Reset to page 1 when query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [query])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  const startEntry = filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endEntry = Math.min(currentPage * itemsPerPage, filtered.length)

  const getVisiblePages = () => {
    const range = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - 2)
    let end = Math.min(totalPages, start + maxVisible - 1)
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i)
    }
    return range
  }

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

      <div className="mt-4 max-h-[calc(100vh-320px)] overflow-auto rounded-lg border border-gray-200">
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
            {paginated.map((log) => (
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

      {filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Nakaraan
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Susunod
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Ipinapakita ang <span className="font-medium">{startEntry}</span> hanggang{' '}
                <span className="font-medium">{endEntry}</span> ng{' '}
                <span className="font-medium">{filtered.length}</span> na resulta
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {getVisiblePages().map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    aria-current={currentPage === page ? 'page' : undefined}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${
                      currentPage === page
                        ? 'z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
