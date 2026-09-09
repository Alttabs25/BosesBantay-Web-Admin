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
          className="rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200/80 px-4 py-2 text-sm font-semibold text-gray-700 transition-all active:scale-[0.98] cursor-pointer"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm hover:shadow transition-all hover:brightness-105 active:scale-[0.98] cursor-pointer ${
            danger
              ? 'bg-gradient-to-b from-red-600 to-red-700/95 border border-red-700/20'
              : 'bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/20'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
