import { useRef, useState } from 'react'
import {
  UploadCloud,
  ShieldCheck,
  Search,
  Bot,
  Sparkles,
  Eye,
  Trash2,
  Archive,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
  FileCode,
  Zap,
} from 'lucide-react'
import { DOCUMENT_CATEGORIES } from '../data/mockDocuments'
import Pill from '../components/Pill'
import ConfirmDialog from '../components/ConfirmDialog'
import KnowledgeTestBenchModal from '../components/KnowledgeTestBenchModal'
import DocumentDetailModal from '../components/DocumentDetailModal'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { can, ROLES } from '../config/permissions'

const STATUS_COLOR = {
  'Fully Indexed': 'green',
  Indexing: 'orange',
  Pending: 'orange',
  Retired: 'gray',
  'Format Issue': 'red',
}

const OFFICIAL_COLOR = {
  Opisyal: 'green',
  'Naghihintay ng Pag-apruba': 'orange',
  'Naka-retire': 'gray',
}

export default function KnowledgeBase() {
  const { user } = useAuth()
  const { documents, addDocument, updateDocument, deleteDocument, addAuditEntry } = useData()
  const { showToast } = useToast()

  const canUpload = can(user.role, 'knowledgeBase', 'create')
  const canDelete = can(user.role, 'knowledgeBase', 'delete')
  const canApprove = can(user.role, 'knowledgeBase', 'approve')

  const isCaptain = user.role === ROLES.CAPTAIN
  const isSecretary = user.role === ROLES.SECRETARY
  const isAdmin = user.role === ROLES.ADMIN

  // Form State
  const [refName, setRefName] = useState('')
  const [ordinanceNo, setOrdinanceNo] = useState('')
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0])
  const [summary, setSummary] = useState('')
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all') // 'all', 'approved', 'pending', 'retired'

  // Dialog & Modal States
  const [pendingRetireDoc, setPendingRetireDoc] = useState(null)
  const [pendingApproveDoc, setPendingApproveDoc] = useState(null)
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState(null)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [testBenchOpen, setTestBenchOpen] = useState(false)

  // Confirmation Handlers
  const confirmRetire = () => {
    if (!pendingRetireDoc) return
    const id = pendingRetireDoc.id || pendingRetireDoc.title
    updateDocument(id, { status: 'Retired', officialStatus: 'Naka-retire' })
    addAuditEntry(`Na-retire ang dokumentong "${pendingRetireDoc.title}"`, { color: 'red' })
    showToast(`Na-retire ang "${pendingRetireDoc.title}". Hindi na ito gagamitin ng chatbot.`)
    setPendingRetireDoc(null)
  }

  const confirmApproveOfficial = () => {
    if (!pendingApproveDoc) return
    const id = pendingApproveDoc.id || pendingApproveDoc.title
    updateDocument(id, { officialStatus: 'Opisyal' })
    addAuditEntry(`Inaprubahan bilang opisyal ang dokumentong "${pendingApproveDoc.title}"`, {
      color: 'green',
    })
    showToast(`Opisyal na ngayon ang "${pendingApproveDoc.title}" para sa Barangay-Bot.`)
    setPendingApproveDoc(null)
  }

  const confirmDelete = () => {
    if (!pendingDeleteDoc) return
    const id = pendingDeleteDoc.id || pendingDeleteDoc.title
    deleteDocument(id)
    addAuditEntry(`Tinanggal mula sa ingestion ang file: "${pendingDeleteDoc.title}"`, {
      color: 'red',
    })
    showToast(`Tinanggal ang file na "${pendingDeleteDoc.title}".`, 'info')
    setPendingDeleteDoc(null)
  }

  const handleTriggerIngest = (doc) => {
    const id = doc.id || doc.title
    updateDocument(id, { status: 'Indexing' })
    showToast(`Sinusuri ang format at ini-extract ang mga seksyon ng "${doc.title}"...`)

    setTimeout(() => {
      updateDocument(id, { status: 'Fully Indexed', chunkCount: 14, isMachineReadable: true })
      addAuditEntry(`Nagsagawa ng technical ingestion para sa "${doc.title}" gamit ang nomic-embed-text-v1`, {
        color: 'green',
      })
      showToast(`Nai-index na ang "${doc.title}" gamit ang nomic-embed-text-v1 (768d). Handa na para sa RAG!`)
    }, 1200)
  }

  // File Validation
  const handleFileSelection = (selectedFile) => {
    if (!selectedFile) return
    const name = selectedFile.name.toLowerCase()
    const isPdf = name.endsWith('.pdf')
    const isDocx = name.endsWith('.docx')

    if (!isPdf && !isDocx) {
      showToast(
        'Tanging text-searchable .PDF at Microsoft Word (.DOCX) lamang ang suportado.',
        'error'
      )
      return
    }

    setFile(selectedFile)
    if (!refName) {
      setRefName(selectedFile.name.replace(/\.[^/.]+$/, ''))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!refName.trim()) {
      showToast('Maglagay ng document reference name.', 'error')
      return
    }
    if (!file) {
      showToast('Pumili ng text-searchable PDF o Word (.docx) bago mag-submit.', 'error')
      return
    }

    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const isDocx = file.name.toLowerCase().endsWith('.docx')
    const format = isDocx ? 'DOCX' : 'PDF'
    const fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    const uploadedName = refName.trim().endsWith(`.${format.toLowerCase()}`)
      ? refName.trim()
      : `${refName.trim()}.${format.toLowerCase()}`

    const newDoc = {
      id: Date.now(),
      title: uploadedName,
      ordinanceNo: ordinanceNo.trim() || '—',
      category,
      dateUploaded: today,
      fileFormat: format,
      fileSize,
      isMachineReadable: true,
      chunkCount: Math.floor(Math.random() * 10) + 12, // Simulated chunk extraction
      status: 'Indexing',
      officialStatus: 'Naghihintay ng Pag-apruba',
      summary:
        summary.trim() ||
        `Opisyal na dokumento ng barangay ukol sa ${category.toLowerCase()}.`,
      sections: [
        {
          title: 'Seksyon 1: Pamagat at Saklaw',
          content: `Ang dokumentong ito ay nagtatakda ng mga alituntunin at patakaran ukol sa ${category}.`,
        },
        {
          title: 'Seksyon 2: Mga Rekisito at Pamantayan',
          content:
            summary.trim() ||
            'Lahat ng residente at establisimyento ay inaatasang sumunod sa mga probisyon nito.',
        },
      ],
      isActive: true,
    }

    addDocument(newDoc)
    addAuditEntry(`Nag-upload ng dokumento: "${uploadedName}" (${format})`, { color: 'blue' })
    showToast(`Na-upload ang "${uploadedName}". Sinusuri ang format at ini-index...`)

    // Technical ingestion simulator
    setTimeout(() => {
      updateDocument(uploadedName, { status: 'Fully Indexed' })
      showToast(
        `Machine-readable at Fully Indexed na ang "${uploadedName}". Naghihintay ng lagda/pag-apruba ng Punong Barangay.`
      )
    }, 1800)

    // Reset Form
    setRefName('')
    setOrdinanceNo('')
    setCategory(DOCUMENT_CATEGORIES[0])
    setSummary('')
    setFile(null)
  }

  // Filtered List
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.ordinanceNo && doc.ordinanceNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.category && doc.category.toLowerCase().includes(searchTerm.toLowerCase()))

    if (!matchesSearch) return false

    if (activeTab === 'approved') return doc.officialStatus === 'Opisyal' && doc.status !== 'Retired'
    if (activeTab === 'pending') return doc.officialStatus === 'Naghihintay ng Pag-apruba' && doc.status !== 'Retired'
    if (activeTab === 'retired') return doc.status === 'Retired' || doc.officialStatus === 'Naka-retire'
    return true
  })

  const pendingApprovalCount = documents.filter(
    (d) => d.officialStatus === 'Naghihintay ng Pag-apruba' && d.status !== 'Retired'
  ).length

  return (
    <div className="space-y-6">
      {/* Top Header & Test Bench Trigger */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-bb-blue" />
            Knowledge Base & Document Management
          </h2>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">
            Upload, beripikahin ang format, at pamahalaan ang mga opisyal na ordinansa at rekisito upang manatiling tumpak ang kaalaman ng Barangay-Bot.
          </p>
        </div>

        {/* Barangay-Bot Test Bench Button */}
        <button
          onClick={() => setTestBenchOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-bb-blue to-bb-blue-dark px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:from-bb-blue-dark hover:to-blue-900 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Bot className="h-4 w-4" />
          <span>I-test ang Barangay-Bot</span>
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
        </button>
      </div>

      {/* Role-Based Governance Banner */}
      {isCaptain && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/80 p-4 text-green-900 shadow-2xs">
          <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-green-950 text-sm flex items-center gap-2">
              Awtoridad sa Nilalaman: Punong Barangay
              {pendingApprovalCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  {pendingApprovalCount} Naghihintay ng Iyong Lagda
                </span>
              )}
            </h4>
            <p className="text-green-800 leading-relaxed">
              Bilang Punong Barangay, ikaw lamang ang may kapangyarihang mag-apruba ng dokumento bilang <strong>"Opisyal"</strong> bago ito magamit ng Barangay-Bot sa pagsagot sa mga residente. Ang teknikal na pag-upload at custodial ingestion ay ginagawa ng Barangay Secretary o System Administrator.
            </p>
          </div>
        </div>
      )}

      {isSecretary && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-blue-900 shadow-2xs">
          <FileCode className="h-5 w-5 text-bb-blue mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-blue-950 text-sm">
              Tungkulin ng Barangay Secretary: Paggawa at Pag-update ng Dokumento
            </h4>
            <p className="text-blue-800 leading-relaxed">
              Maaari kang mag-upload ng mga bagong resolusyon, ordinansa, at gabay sa clearance (PDF o Word .docx). Bawat dokumentong iyong i-upload ay dadaan muna sa technical ingestion bago pinal na aprubahan ng Punong Barangay bilang opisyal.
            </p>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 text-indigo-900 shadow-2xs">
          <Layers className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-indigo-950 text-sm">
              Tungkulin ng System Administrator: Technical Ingestion & Format Custody
            </h4>
            <p className="text-indigo-800 leading-relaxed">
              Ikaw ang responsable sa technical ingestion, format compliance (pagsusuri kung machine-readable ang PDF/DOCX), at technical file deletion. Ang nilalaman at pagiging opisyal nito ay eksklusibong nasa desisyon ng Punong Barangay.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Document Table & Upload Form */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Document List & Filters */}
        <div className="flex-1 space-y-4">
          {/* Controls Bar: Search & Status Tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 text-xs font-semibold text-gray-600">
              <button
                onClick={() => setActiveTab('all')}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  activeTab === 'all' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'hover:text-gray-900'
                }`}
              >
                Lahat ({documents.length})
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  activeTab === 'approved'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'hover:text-gray-900'
                }`}
              >
                Published ({documents.filter((d) => d.officialStatus === 'Opisyal' && d.status !== 'Retired').length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                    : 'hover:text-gray-900'
                }`}
              >
                Pending Review ({pendingApprovalCount})
              </button>
              <button
                onClick={() => setActiveTab('retired')}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  activeTab === 'retired'
                    ? 'bg-white text-gray-700 shadow-xs font-bold'
                    : 'hover:text-gray-900'
                }`}
              >
                Archived ({documents.filter((d) => d.status === 'Retired' || d.officialStatus === 'Naka-retire').length})
              </button>
            </div>

            {/* Search Input & Test Bot Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Maghanap ng dokumento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </div>

              <button
                onClick={() => setTestBenchOpen(true)}
                title="Subukan ang pagsagot ng Barangay-Bot gamit ang nomic-embed-text-v1 at Llama 3.1 8B"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-bb-blue to-bb-blue-dark px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:from-bb-blue-dark hover:to-blue-900 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                <Bot className="h-4 w-4" />
                <span>Test Bot</span>
                <Sparkles className="h-3 w-3 text-amber-300" />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xs">
            <div className="max-h-[calc(100vh-320px)] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Dokumento at Ordinansa</th>
                    <th className="px-3 py-3">Format / Laki</th>
                    <th className="px-3 py-3">Kategorya</th>
                    <th className="px-3 py-3">Petsa</th>
                    <th className="px-3 py-3">Ingestion</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        Walang nahanap na dokumento para sa filter na ito.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr
                        key={doc.id || doc.title}
                        className="hover:bg-gray-50/70 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800 max-w-xs truncate" title={doc.title}>
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-bb-blue font-medium">
                              {doc.ordinanceNo || 'Walang Ordinance No.'}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <span
                              className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                                doc.fileFormat === 'DOCX'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {doc.fileFormat ?? 'PDF'}
                            </span>
                            <span className="text-[11px] text-gray-400">{doc.fileSize ?? '1.2 MB'}</span>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span className="text-gray-600 block max-w-[120px] truncate" title={doc.category}>
                            {doc.category || 'Ordinansa'}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                          {doc.dateUploaded}
                        </td>

                        <td className="px-3 py-3">
                          <Pill color={STATUS_COLOR[doc.status] ?? 'gray'} solid={false}>
                            {doc.status === 'Fully Indexed' ? 'Indexed' : doc.status === 'Pending' ? 'Pending Ingest' : doc.status}
                          </Pill>
                        </td>

                        <td className="px-3 py-3">
                          <Pill color={OFFICIAL_COLOR[doc.officialStatus] ?? 'gray'}>
                            {doc.officialStatus === 'Opisyal' ? 'Published' : doc.officialStatus === 'Naghihintay ng Pag-apruba' ? 'Pending Review' : 'Archived'}
                          </Pill>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View / Detail Button */}
                            <button
                              onClick={() => setSelectedDoc(doc)}
                              title="Tingnan ang detalye at mga seksyon"
                              className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-bb-blue transition-colors cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {/* System Administrator Ingest Button for Pending Docs */}
                            {isAdmin && (doc.status === 'Pending' || doc.status === 'Indexing') && (
                              <button
                                onClick={() => handleTriggerIngest(doc)}
                                title="I-proseso ang Ingestion at nomic-embed-text-v1 chunking"
                                className="flex items-center gap-1 rounded-full bg-amber-500 hover:bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-xs transition-all active:scale-[0.96] cursor-pointer"
                              >
                                <Zap className="h-3.5 w-3.5" />
                                Ingest
                              </button>
                            )}

                            {/* Punong Barangay Approve / Publish Button */}
                            {canApprove &&
                              doc.officialStatus !== 'Opisyal' &&
                              doc.status !== 'Retired' && (
                                <button
                                  onClick={() => setPendingApproveDoc(doc)}
                                  className="flex items-center gap-1 rounded-full bg-gradient-to-b from-green-600 to-green-700 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:from-green-700 hover:to-green-800 transition-all active:scale-[0.96] cursor-pointer"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  Publish
                                </button>
                              )}

                            {/* Retire Button (Admin / Secretary / Captain) */}
                            {canDelete && doc.status !== 'Retired' && (
                              <button
                                onClick={() => setPendingRetireDoc(doc)}
                                title="I-retire ang dokumento (hindi na magagamit ng chatbot)"
                                className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}

                            {/* Hard Delete Button (System Administrator Custodial Role) */}
                            {canDelete && (
                              <button
                                onClick={() => setPendingDeleteDoc(doc)}
                                title="Tanggalin ang file mula sa database (Hard Delete)"
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Upload Panel (Authorized Secretary and Admin) */}
        {canUpload && (
          <form
            onSubmit={handleSubmit}
            className="w-full space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-xs lg:w-96 shrink-0"
          >
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-bb-blue" />
                Mag-upload ng Dokumento
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Para sa kaalaman ng Barangay-Bot at opisyal na archival.
              </p>
            </div>

            {/* Compliance Warning Notice */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-950">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Pansin: Format Compliance</span>
              </div>
              Tanging <strong>text-searchable PDF</strong> o <strong>Microsoft Word (.docx)</strong> lamang ang sinusuportahan. Hindi tinatanggap ang mga scanned image-only PDF at sulat-kamay.
            </div>

            {/* Document Title */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">
                Document Reference Name *
              </span>
              <input
                type="text"
                required
                value={refName}
                onChange={(e) => setRefName(e.target.value)}
                placeholder="Hal. Ordinance_2026_Curfew.pdf"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>

            {/* Ordinance / Resolution No. */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">
                Ordinance / Resolution / Policy No.
              </span>
              <input
                type="text"
                value={ordinanceNo}
                onChange={(e) => setOrdinanceNo(e.target.value)}
                placeholder="Hal. Ord. Blg. 2026-003"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>

            {/* Classification Category */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">
                Klase ng Klasipikasyon
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue bg-white"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {/* Brief Executive Summary */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700">
                Maikling Buod (Executive Summary)
              </span>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Maikling paglalarawan sa nilalaman ng ordinansa o gabay..."
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue resize-none"
              />
            </label>

            {/* Drag and Drop Box */}
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
                if (dropped) handleFileSelection(dropped)
              }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                isDragging
                  ? 'border-bb-blue bg-bb-blue/5'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/40'
                  : 'border-gray-300 hover:border-bb-blue'
              }`}
            >
              {file ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-900 truncate max-w-full">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {(file.size / 1024).toFixed(0)} KB • I-click upang palitan ang file
                  </p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6 text-bb-blue" />
                  <p className="text-xs text-gray-600 font-medium">
                    I-click upang pumili o i-drag ang file dito
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Suportado: Text-searchable .PDF o Word .DOCX
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => handleFileSelection(e.target.files?.[0] ?? null)}
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-bb-blue py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-bb-blue-dark transition-all active:scale-[0.98] cursor-pointer"
            >
              Isumite para sa Ingestion
            </button>
          </form>
        )}
      </div>

      {/* Detail / Preview Modal */}
      <DocumentDetailModal
        open={selectedDoc != null}
        onClose={() => setSelectedDoc(null)}
        doc={selectedDoc}
        canApprove={canApprove}
        canDelete={canDelete}
        onApprove={(d) => setPendingApproveDoc(d)}
        onRetire={(d) => setPendingRetireDoc(d)}
        onDelete={(d) => setPendingDeleteDoc(d)}
      />

      {/* Barangay-Bot Knowledge Test Bench Modal */}
      <KnowledgeTestBenchModal
        open={testBenchOpen}
        onClose={() => setTestBenchOpen(false)}
        documents={documents}
      />

      {/* Confirmation Dialog: Punong Barangay Approve */}
      <ConfirmDialog
        open={pendingApproveDoc != null}
        onClose={() => setPendingApproveDoc(null)}
        onConfirm={confirmApproveOfficial}
        title="Gawing Opisyal ang Dokumento"
        message={`Bilang Punong Barangay, sigurado ka bang nais mong aprubahan bilang "Opisyal" ang "${pendingApproveDoc?.title}"? Magiging live reference na ito para sa pagsagot ng Barangay-Bot.`}
        confirmLabel="Gawing Opisyal"
        danger={false}
      />

      {/* Confirmation Dialog: Retire Document */}
      <ConfirmDialog
        open={pendingRetireDoc != null}
        onClose={() => setPendingRetireDoc(null)}
        onConfirm={confirmRetire}
        title="I-retire ang Dokumento"
        message={`Sigurado ka bang nais mong i-retire ang "${pendingRetireDoc?.title}"? Mananatili ito sa archival logs ngunit hindi na sasangguniin ng Barangay-Bot.`}
        confirmLabel="I-retire"
      />

      {/* Confirmation Dialog: Technical Delete (System Administrator) */}
      <ConfirmDialog
        open={pendingDeleteDoc != null}
        onClose={() => setPendingDeleteDoc(null)}
        onConfirm={confirmDelete}
        title="Tanggalin ang Dokumento (Hard Delete)"
        message={`Bilang System Administrator, sigurado ka bang nais mong tuluyang tanggalin ang "${pendingDeleteDoc?.title}" mula sa sistema at storage? Hindi na ito maibabalik.`}
        confirmLabel="Tuluyang Tanggalin"
        danger={true}
      />
    </div>
  )
}
