import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const VARIANTS = {
  success: { icon: CheckCircle2, className: 'border-green-500 text-green-700' },
  error: { icon: XCircle, className: 'border-red-500 text-red-700' },
  info: { icon: Info, className: 'border-bb-blue text-bb-blue' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message, variant = 'success') => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => dismiss(id), 3500)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[1400] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6 print:hidden" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => {
          const { icon: Icon, className } = VARIANTS[t.variant] ?? VARIANTS.info
          return (
            <div
              key={t.id}
              role={t.variant === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 bg-white px-4 py-4 text-sm font-medium shadow-[0_8px_30px_rgba(15,23,42,0.14)] ${className}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 break-words leading-relaxed text-gray-800">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Isara ang abiso"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
