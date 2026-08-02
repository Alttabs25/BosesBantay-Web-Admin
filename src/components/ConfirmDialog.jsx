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
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-sm text-gray-600">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-gradient-to-b from-gray-200 to-gray-300/80 border border-gray-200/20 shadow-xs hover:shadow-sm px-4 py-2 text-sm font-semibold text-gray-700 hover:from-gray-300 hover:to-gray-400 transition-all active:scale-[0.98]"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className={`rounded-lg border border-black/5 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:shadow-sm transition-all hover:brightness-105 active:scale-[0.98] ${
            danger
              ? 'bg-gradient-to-b from-red-600 to-red-700/90'
              : 'bg-gradient-to-b from-bb-blue to-bb-blue/90'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
