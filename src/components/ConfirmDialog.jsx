import Modal from './Modal'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Kumpirmahin',
  cancelLabel = 'Kanselahin',
  danger = true,
  maxWidth = 'max-w-md',
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={maxWidth}>
      <p className="text-sm text-gray-600 leading-relaxed break-words">{message}</p>
      <div className="mt-6 flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className={`rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer ${
            danger
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-bb-blue hover:bg-bb-blue-dark'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
