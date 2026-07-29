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
          className="rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-bb-blue hover:bg-bb-blue-dark'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
