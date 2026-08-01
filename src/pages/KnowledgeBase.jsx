import { useRef, useState } from 'react'
import { Download, ShieldCheck } from 'lucide-react'
import { DOCUMENT_CATEGORIES } from '../data/mockDocuments'
import Pill from '../components/Pill'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { can } from '../config/permissions'

const STATUS_COLOR = {
  'Fully Indexed': 'green',
  Indexing: 'orange',
  Retired: 'gray',
}

const OFFICIAL_COLOR = {
  Opisyal: 'green',
  'Naghihintay ng Pag-apruba': 'orange',
}

export default function KnowledgeBase() {
  const { user } = useAuth()
  const { documents, addDocument, updateDocument, addAuditEntry } = useData()
  const { showToast } = useToast()

  const canUpload = can(user.role, 'knowledgeBase', 'create')
  const canDelete = can(user.role, 'knowledgeBase', 'delete')
  const canApprove = can(user.role, 'knowledgeBase', 'approve')

  const [refName, setRefName] = useState('')
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0])
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)
  const [pendingRetireTitle, setPendingRetireTitle] = useState(null)
  const [pendingApproveTitle, setPendingApproveTitle] = useState(null)

  const confirmRetire = () => {
    const title = pendingRetireTitle
    updateDocument(title, { status: 'Retired' })
    addAuditEntry(`Na-retire ang dokumentong "${title}"`, { color: 'red' })
    showToast(`Na-retire ang "${title}".`)
    setPendingRetireTitle(null)
  }

  const confirmApproveOfficial = () => {
    const title = pendingApproveTitle
    updateDocument(title, { officialStatus: 'Opisyal' })
    addAuditEntry(`Inaprubahan bilang opisyal ang dokumentong "${title}"`, { color: 'green' })
    showToast(`Opisyal na ngayon ang "${title}" para sa chatbot.`)
    setPendingApproveTitle(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!refName.trim()) {
      showToast('Maglagay ng document reference name.', 'error')
      return
    }
    if (!file) {
      showToast('Pumili muna ng PDF na i-uupload.', 'error')
      return
    }

    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    const uploadedName = refName.trim()

    addDocument({
      title: uploadedName,
      dateUploaded: today,
      status: 'Indexing',
      officialStatus: 'Naghihintay ng Pag-apruba',
    })
    addAuditEntry(`Nag-upload ng dokumento: "${uploadedName}"`, { color: 'blue' })
    showToast(`Na-upload ang "${uploadedName}". Ino-index ngayon...`)

    setTimeout(() => {
      updateDocument(uploadedName, { status: 'Fully Indexed' })
      showToast(`Fully indexed na ang "${uploadedName}". Naghihintay pa ng PB approval.`)
    }, 1500)

    setRefName('')
    setCategory(DOCUMENT_CATEGORIES[0])
    setFile(null)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Manage Document</h2>
      <p className="mt-1 text-sm text-gray-500">
        Upload and maintain official barangay-specific documents to keep
        chatbot references verified and precise.
      </p>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <div className="max-h-[calc(100vh-260px)] flex-1 overflow-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Document Title</th>
                <th className="px-4 py-3 font-semibold">Date Uploaded</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Opisyal</th>
                <th className="px-4 py-3 font-semibold">Aksyon</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.title} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-700">{doc.title}</td>
                  <td className="px-4 py-3 text-gray-500">{doc.dateUploaded}</td>
                  <td className="px-4 py-3">
                    <Pill color={STATUS_COLOR[doc.status] ?? 'gray'} solid>
                      {doc.status}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill color={OFFICIAL_COLOR[doc.officialStatus] ?? 'gray'}>
                      {doc.officialStatus}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canApprove && doc.officialStatus !== 'Opisyal' && doc.status !== 'Retired' && (
                        <button
                          onClick={() => setPendingApproveTitle(doc.title)}
                          className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          <ShieldCheck size={12} />
                          Gawing Opisyal
                        </button>
                      )}
                      {canDelete && doc.status !== 'Retired' && (
                        <button
                          onClick={() => setPendingRetireTitle(doc.title)}
                          className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Retire File
                        </button>
                      )}
                      {!canApprove && !(canDelete && doc.status !== 'Retired') && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canUpload && (
          <form
            onSubmit={handleSubmit}
            className="w-full space-y-4 rounded-lg border border-bb-blue/40 p-5 lg:w-96"
          >
            <h3 className="font-semibold text-bb-blue">Upload Ordinance Document</h3>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Document Reference Name
              </span>
              <input
                type="text"
                required
                value={refName}
                onChange={(e) => setRefName(e.target.value)}
                placeholder="e.g., Executive_Order_Safety.pdf"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Klase ng Klasipikasyon
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const dropped = e.dataTransfer.files?.[0]
                if (dropped) setFile(dropped)
              }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragging ? 'border-bb-blue bg-bb-blue-light' : 'border-gray-300'
              }`}
            >
              <Download size={22} className="text-bb-blue" />
              <p className="text-sm text-gray-500">
                {file
                  ? file.name
                  : 'i-click upang pumili ng opisyal na PDF o i-drag ang mga file ng ordinansa dito'}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-bb-blue py-2.5 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
            >
              Isumite
            </button>
          </form>
        )}

        {canApprove && (
          <div className="w-full space-y-2 rounded-lg border border-green-200 bg-green-50 p-5 lg:w-96">
            <h3 className="flex items-center gap-1.5 font-semibold text-green-700">
              <ShieldCheck size={16} />
              Awtoridad sa Opisyal na Dokumento
            </h3>
            <p className="text-sm text-green-800">
              Bilang Punong Barangay, ikaw lamang ang may kapangyarihang gawing
              "Opisyal" ang isang dokumento bago ito magamit ng chatbot. Ang
              teknikal na pag-upload at pag-retire ay ginagawa ng Barangay
              Secretary o System Administrator.
            </p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingApproveTitle != null}
        onClose={() => setPendingApproveTitle(null)}
        onConfirm={confirmApproveOfficial}
        title="Gawing Opisyal ang Dokumento"
        message={`Sigurado ka bang gusto mong gawing opisyal ang "${pendingApproveTitle}"? Magiging available na ito bilang reference ng chatbot.`}
        confirmLabel="Gawing Opisyal"
        danger={false}
      />

      <ConfirmDialog
        open={pendingRetireTitle != null}
        onClose={() => setPendingRetireTitle(null)}
        onConfirm={confirmRetire}
        title="I-retire ang Dokumento"
        message={`Sigurado ka bang gusto mong i-retire ang "${pendingRetireTitle}"? Hindi na ito magagamit ng chatbot bilang reference.`}
        confirmLabel="I-retire"
      />
    </div>
  )
}
