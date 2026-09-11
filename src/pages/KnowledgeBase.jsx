import { useRef, useState } from 'react'
import {
  UploadCloud,
  ShieldCheck,
  Search,
  Bot,
  Eye,
  Trash2,
  Archive,
  FileText,
  AlertCircle,
  CheckCircle2,
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
import { extractTextFromFile, parseDocumentSections } from '../utils/pdfExtractor'

const STATUS_COLOR = {
  'Fully Indexed': 'blue',
  'Indexed': 'blue',
  Indexing: 'sky',
  Pending: 'slate',
  'Pending Ingest': 'slate',
  'Not Indexed': 'slate',
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

  const isAdmin = user.role === ROLES.ADMIN

  // Form State
  const [refName, setRefName] = useState('')
  const [ordinanceNo, setOrdinanceNo] = useState('')
  const [category, setCategory] = useState(DOCUMENT_CATEGORIES[0])
  const [summary, setSummary] = useState('')
  const [documentText, setDocumentText] = useState('')
  const [extracting, setExtracting] = useState(false)
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
  const confirmRetire = async () => {
    if (!pendingRetireDoc) return
    const docToRetire = pendingRetireDoc
    setPendingRetireDoc(null)
    const id = docToRetire.id || docToRetire.title
    await updateDocument(id, { status: 'Retired', officialStatus: 'Naka-retire' })
    await addAuditEntry(`Na-retire ang dokumentong "${docToRetire.title}"`, { color: 'red' })
    showToast(`Na-retire ang "${docToRetire.title}". Hindi na ito gagamitin ng chatbot.`)
  }

  const confirmApproveOfficial = async () => {
    if (!pendingApproveDoc) return
    const docToApprove = pendingApproveDoc
    setPendingApproveDoc(null)
    const id = docToApprove.id || docToApprove.title
    await updateDocument(id, { officialStatus: 'Opisyal' })
    await addAuditEntry(`Inaprubahan bilang opisyal ang dokumentong "${docToApprove.title}"`, {
      color: 'green',
    })
    showToast(`Opisyal na ngayon ang "${docToApprove.title}" para sa Barangay-Bot.`)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteDoc) return
    const docToDelete = pendingDeleteDoc
    setPendingDeleteDoc(null)
    const id = docToDelete.id || docToDelete.title
    await deleteDocument(id, docToDelete.title)
    await addAuditEntry(`Tinanggal mula sa ingestion ang file: "${docToDelete.title}"`, {
      color: 'red',
    })
    showToast(`Tinanggal ang file na "${docToDelete.title}".`, 'info')
  }

  const handleTriggerIngest = (doc) => {
    const id = doc.id || doc.title
    updateDocument(id, { status: 'Indexing' })
    showToast(`Sinusuri ang format at ini-extract ang mga seksyon ng "${doc.title}"...`)

    setTimeout(() => {
      updateDocument(id, { status: 'Fully Indexed', chunkCount: 14, isMachineReadable: true })
      addAuditEntry(`Nagsagawa ng pag-index para sa dokumentong "${doc.title}"`, {
        color: 'green',
      })
      showToast(`Nai-index na ang "${doc.title}". Handa na para sa pagsubok.`)
    }, 1200)
  }

  // File Validation and Automatic Text Extraction
  const handleFileSelection = async (selectedFile) => {
    if (!selectedFile) return
    const name = selectedFile.name.toLowerCase()
    const isPdf = name.endsWith('.pdf')
    const isDocx = name.endsWith('.docx')
    const isTxt = name.endsWith('.txt') || name.endsWith('.md')

    if (!isPdf && !isDocx && !isTxt) {
      showToast(
        'Tanging text-searchable .PDF, Microsoft Word (.DOCX), at .TXT lamang ang suportado.',
        'error'
      )
      return
    }

    setFile(selectedFile)
    if (!refName) {
      setRefName(selectedFile.name.replace(/\.[^/.]+$/, ''))
    }

    // Extract real text from file
    setExtracting(true)
    showToast('Sinisimulan ang pag-extract ng teksto mula sa file...', 'info')
    try {
      const extracted = await extractTextFromFile(selectedFile)
      if (extracted && extracted.trim()) {
        setDocumentText(extracted.trim())
        if (!summary.trim()) {
          setSummary(extracted.trim().slice(0, 250) + '...')
        }
        showToast('Matagumpay na na-extract ang teksto mula sa dokumento para sa AI indexing!', 'success')
      } else {
        showToast('Nai-attach ang file. Maaari ring mag-paste o mag-edit ng teksto sa kahon sa ibaba.', 'info')
      }
    } catch (err) {
      console.warn('Text extraction error:', err)
    } finally {
      setExtracting(false)
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

    const cleanTitle = uploadedName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
    const contentToUse = documentText.trim() || summary.trim()
    const finalSections = parseDocumentSections(contentToUse, cleanTitle)
    const finalSummary =
      summary.trim() ||
      (documentText.trim() ? documentText.trim().slice(0, 300) + '...' : `Opisyal na dokumento ukol sa ${cleanTitle}.`)

    const newDoc = {
      id: Date.now(),
      title: uploadedName,
      ordinanceNo: ordinanceNo.trim() || '—',
      category,
      dateUploaded: today,
      fileFormat: format,
      fileSize,
      isMachineReadable: true,
      chunkCount: finalSections.length,
      status: 'Indexing',
      officialStatus: 'Naghihintay ng Pag-apruba',
      summary: finalSummary,
      sections: finalSections,
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
    setDocumentText('')
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
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
    <div className="space-y-4">
      {/* Top Header & Test Bench Trigger */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-bb-blue" />
            Knowledge Base & Document Management
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 max-w-2xl">
            Upload, beripikahin ang format, at pamahalaan ang mga opisyal na ordinansa at rekisito upang manatiling tumpak ang kaalaman ng Barangay-Bot.
          </p>
        </div>

        {/* Barangay-Bot Test Bench Button */}
        <button
          onClick={() => setTestBenchOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-3.5 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98] cursor-pointer shrink-0"
        >
          <Bot className="h-4 w-4 text-white" />
          <span>I-test ang Barangay-Bot</span>
        </button>
      </div>

      {/* Main Grid: Document Table & Upload Form */}
      <div className="flex flex-col gap-4 lg:flex-row items-start">
        {/* Document List & Filters */}
        <div className="flex-1 min-w-0 space-y-3 w-full">
          {/* Controls Bar: Search & Status Tabs */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-50/50 rounded-xl p-1.5">
              {[
                {
                  value: 'all',
                  label: 'Lahat',
                  count: documents.length,
                  activeClass: 'bg-bb-blue text-white shadow-sm',
                },
                {
                  value: 'approved',
                  label: 'Published',
                  count: documents.filter((d) => d.officialStatus === 'Opisyal' && d.status !== 'Retired').length,
                  activeClass: 'bg-green-600 text-white shadow-sm',
                },
                {
                  value: 'pending',
                  label: 'Naghihintay',
                  count: pendingApprovalCount,
                  activeClass: 'bg-orange-500 text-white shadow-sm',
                },
                {
                  value: 'retired',
                  label: 'Archived',
                  count: documents.filter((d) => d.status === 'Retired' || d.officialStatus === 'Naka-retire').length,
                  activeClass: 'bg-gray-500 text-white shadow-sm',
                },
              ].map((pill) => {
                const isActive = activeTab === pill.value

                return (
                  <button
                    key={pill.value}
                    onClick={() => setActiveTab(pill.value)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${isActive
                      ? `${pill.activeClass} scale-102`
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-500 border border-gray-200/50'
                        }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-48 xl:w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Maghanap ng dokumento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2.5 py-1.5 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xs">
            <div className="max-h-[calc(100vh-230px)] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Dokumento at Ordinansa</th>
                    <th className="px-2 py-2">Format / Laki</th>
                    <th className="px-2 py-2">Kategorya</th>
                    <th className="px-2 py-2">Petsa</th>
                    <th className="px-2 py-2">Ingestion</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Aksyon</th>
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
                        <td className="px-3 py-2">
                          <div className="font-semibold text-gray-800 max-w-[160px] sm:max-w-[190px] xl:max-w-[220px] truncate text-xs" title={doc.title}>
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-bb-blue font-medium truncate max-w-[150px]">
                              {doc.ordinanceNo || 'Walang Ordinance No.'}
                            </span>
                          </div>
                        </td>

                        <td className="px-2 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span
                              className={`rounded px-1 py-0.2 text-[9px] font-bold ${doc.fileFormat === 'DOCX'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                                }`}
                            >
                              {doc.fileFormat ?? 'PDF'}
                            </span>
                            <span className="text-[10px] text-gray-400">{doc.fileSize ?? '1.2 MB'}</span>
                          </div>
                        </td>

                        <td className="px-2 py-2">
                          <span className="text-gray-600 block max-w-[100px] truncate text-[11px]" title={doc.category}>
                            {doc.category || 'Ordinansa'}
                          </span>
                        </td>

                        <td className="px-2 py-2 text-gray-500 whitespace-nowrap text-[11px]">
                          {doc.dateUploaded}
                        </td>

                        <td className="px-2 py-2 whitespace-nowrap">
                          <Pill color={STATUS_COLOR[doc.status] ?? 'gray'} solid={false}>
                            {doc.status === 'Fully Indexed' ? 'Indexed' : doc.status === 'Pending' ? 'Not Indexed' : doc.status}
                          </Pill>
                        </td>

                        <td className="px-2 py-2 whitespace-nowrap">
                          <Pill color={OFFICIAL_COLOR[doc.officialStatus] ?? 'gray'}>
                            {doc.officialStatus === 'Opisyal' ? 'Published' : doc.officialStatus === 'Naghihintay ng Pag-apruba' ? 'Pending' : 'Archived'}
                          </Pill>
                        </td>

                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* View / Detail Button */}
                            <button
                              onClick={() => setSelectedDoc(doc)}
                              title="Tingnan ang detalye at mga seksyon"
                              className="rounded-full p-1 text-gray-400 hover:text-bb-blue hover:bg-blue-50 border border-transparent hover:border-blue-200/60 transition-all cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            {/* System Administrator Ingest Button */}
                            {isAdmin && (doc.status === 'Pending' || doc.status === 'Indexing') && (
                              <button
                                onClick={() => handleTriggerIngest(doc)}
                                title="I-proseso at i-index ang dokumento"
                                className="flex items-center gap-1 rounded-md bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-xs hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-2 py-0.5 text-[11px] font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
                              >
                                <Zap className="h-3 w-3 text-white" />
                                <span>Ingest</span>
                              </button>
                            )}

                            {/* Punong Barangay Approve / Publish Button */}
                            {canApprove &&
                              doc.officialStatus !== 'Opisyal' &&
                              doc.status !== 'Retired' && (
                                <button
                                  onClick={() => setPendingApproveDoc(doc)}
                                  title="Aprubahan bilang Opisyal na Dokumento"
                                  className="flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 shadow-xs hover:shadow px-2 py-0.5 text-[11px] font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
                                >
                                  <ShieldCheck className="h-3 w-3 text-white" />
                                  <span>Publish</span>
                                </button>
                              )}

                            {/* Retire Button (Admin / Secretary / Captain) */}
                            {canDelete && doc.status !== 'Retired' && (
                              <button
                                onClick={() => setPendingRetireDoc(doc)}
                                title="I-retire ang dokumento (hindi na magagamit ng chatbot)"
                                className="rounded-full p-1 text-gray-400 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200/60 transition-all cursor-pointer"
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Hard Delete Button (System Administrator Custodial Role) */}
                            {canDelete && (
                              <button
                                onClick={() => setPendingDeleteDoc(doc)}
                                title="Tanggalin ang file mula sa database (Hard Delete)"
                                className="rounded-full p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200/60 transition-all cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
            className="w-full space-y-2.5 rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs lg:w-72 xl:w-80 shrink-0"
          >
            <div className="border-b border-gray-100 pb-2">
              <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                <UploadCloud className="h-4 w-4 text-bb-blue" />
                Mag-upload ng Dokumento
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Para sa kaalaman ng Barangay-Bot at archival.
              </p>
            </div>

            {/* Compliance Warning Notice */}
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-2.5 py-1.5 text-[10px] text-amber-900 flex items-center gap-1.5 leading-snug">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span><strong>Paalala:</strong> Text-searchable PDF o DOCX lamang.</span>
            </div>

            {/* Document Title */}
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-semibold text-gray-700">
                Document Reference Name *
              </span>
              <input
                type="text"
                required
                value={refName}
                onChange={(e) => setRefName(e.target.value)}
                placeholder="Hal. Ordinance_2026_Curfew.pdf"
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>

            {/* Ordinance / Resolution No. & Classification in 2 columns */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[11px] font-semibold text-gray-700 truncate">
                  Ord. / Res. Blg.
                </span>
                <input
                  type="text"
                  value={ordinanceNo}
                  onChange={(e) => setOrdinanceNo(e.target.value)}
                  placeholder="Hal. Ord. 2026-003"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </label>

              <label className="block">
                <span className="mb-0.5 block text-[11px] font-semibold text-gray-700 truncate">
                  Klasipikasyon
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue bg-white"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Brief Executive Summary */}
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-semibold text-gray-700">
                Maikling Buod (Executive Summary)
              </span>
              <textarea
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Maikling buod ng ordinansa o gabay..."
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue resize-none"
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
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed p-3 text-center transition-colors ${isDragging
                ? 'border-bb-blue bg-bb-blue/5'
                : file
                  ? 'border-emerald-300 bg-emerald-50/40'
                  : 'border-gray-300 hover:border-bb-blue'
                }`}
            >
              {file ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-900 truncate max-w-full">
                    {file.name}
                  </p>
                  <p className="text-[9px] text-gray-500">
                    {(file.size / 1024).toFixed(0)} KB • I-click upang palitan
                  </p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-5 w-5 text-bb-blue" />
                  <p className="text-xs text-gray-600 font-medium">
                    I-click o i-drag ang file dito
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

            {/* Full Document Content / Extracted Text Box */}
            <label className="block">
              <span className="mb-0.5 flex items-center justify-between text-[11px] font-semibold text-gray-700">
                <span>Nilalaman ng Dokumento (AI Text Chunks)</span>
                {extracting ? (
                  <span className="text-[10px] text-bb-blue font-medium animate-pulse">Ini-extract ang PDF...</span>
                ) : (
                  <span className="text-[10px] text-gray-400 font-normal">Auto-extracted o i-paste</span>
                )}
              </span>
              <textarea
                rows={3}
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                placeholder="Awtomatikong lalabas dito ang teksto ng in-upload na PDF/DOCX, o maaari ring i-paste ang buong nilalaman dito..."
                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue resize-y font-sans"
              />
            </label>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-2 text-xs font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5 text-white" />
              <span>Isumite para sa Ingestion</span>
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

      {/* Confirmation Dialog: Approve / Publish */}
      <ConfirmDialog
        open={pendingApproveDoc != null}
        onClose={() => setPendingApproveDoc(null)}
        onConfirm={confirmApproveOfficial}
        title="Gawing Opisyal ang Dokumento"
        message={`Sigurado ka bang nais mong aprubahan bilang "Opisyal" ang "${pendingApproveDoc?.title}"? Magiging live reference na ito para sa pagsagot ng Barangay-Bot.`}
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
