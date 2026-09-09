import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-[2px] transition-opacity duration-200">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
        {/* Backdrop click dismiss */}
        <div
          onClick={onClose}
          className="fixed inset-0"
          aria-hidden="true"
        />

        {/* Modal Dialog Box */}
        <div
          className={`relative my-auto w-full ${maxWidth} transform rounded-2xl bg-white p-6 text-left shadow-2xl transition-all z-10 border border-gray-100/80 animate-fade-in-scale`}
        >
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <h3 className="text-lg font-bold text-gray-900 leading-snug">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label="Isara"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

