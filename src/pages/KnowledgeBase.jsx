import './KnowledgeBase.css'
import { useRef, useState } from 'react'
import {
  UploadCloud,
  ShieldCheck,
  Search,
  Bot,
  Eye,
  Trash2,
  Archive,
  ChevronRight,
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
  const publishedCount = documents.filter(
    (document) => document.officialStatus === 'Opisyal' && document.status !== 'Retired',
  ).length
  const archivedCount = documents.filter(
    (document) => document.status === 'Retired' || document.officialStatus === 'Naka-retire',
  ).length
  const documentMetrics = [
    { value: 'all', label: 'Lahat ng dokumento', count: documents.length, tone: 'blue' },
    { value: 'approved', label: 'Published', count: publishedCount, tone: 'green' },
    { value: 'pending', label: 'Naghihintay', count: pendingApprovalCount, tone: 'amber' },
    { value: 'retired', label: 'Archived', count: archivedCount, tone: 'slate' },
  ]

  return (
    <div className="knowledge-page">
      <section className="knowledge-metric-grid" aria-label="Buod ng document library">
        {documentMetrics.map((metric) => (
          <button
            type="button"
            key={metric.value}
            onClick={() => setActiveTab(metric.value)}
            aria-pressed={activeTab === metric.value}
            className={`knowledge-metric tone-${metric.tone} ${activeTab === metric.value ? 'is-active' : ''}`}
          >
            <span><i aria-hidden="true" />{metric.label}</span>
            <strong>{metric.count}</strong>
          </button>
        ))}
      </section>

      {/* Main Grid: Document Table & Upload Form */}
      <div className={`knowledge-workspace ${canUpload ? 'has-upload' : ''}`}>
        {/* Document List & Filters */}
        <section className="knowledge-registry">
          {/* Controls Bar: Search & Status Tabs */}
          <div className="knowledge-registry-toolbar">
            <div>
              <p className="knowledge-registry-kicker">Official reference library</p>
              <h2>Document registry <span>{filteredDocuments.length} / {documents.length}</span></h2>
            </div>

            <div className="knowledge-registry-actions">
              {/* Search Input */}
              <div className="knowledge-search">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Maghanap ng dokumento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2.5 py-2 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </div>
              <button
                type="button"
                onClick={() => setTestBenchOpen(true)}
                className="knowledge-test-button"
              >
                <Bot className="h-4 w-4" />
                <span className="hidden xl:inline">I-test ang Barangay-Bot</span>
                <span className="xl:hidden">I-test</span>
              </button>
            </div>
          </div>

          <div className="knowledge-document-list max-h-[calc(100vh-245px)] overflow-y-auto">
            {filteredDocuments.length === 0 && <div className="knowledge-empty-state"><FileText size={24} /><h3>Walang nahanap na dokumento</h3><p>Subukan ang ibang search term o status filter.</p></div>}
            {filteredDocuments.map((doc) => {
              const format = doc.fileFormat ?? 'PDF'
              const ingestionLabel = doc.status === 'Fully Indexed' ? 'Indexed' : doc.status === 'Pending' ? 'Not Indexed' : doc.status
              const officialLabel = doc.officialStatus === 'Opisyal' ? 'Published' : doc.officialStatus === 'Naghihintay ng Pag-apruba' ? 'Pending' : 'Archived'
              return <article key={doc.id || doc.title} className="knowledge-document-card">
                <div className="knowledge-document-main">
                  <span className={`knowledge-file-icon format-${format.toLowerCase()}`} aria-hidden="true"><FileText size={20} /><small>{format}</small></span>
                  <div className="knowledge-document-identity">
                    <button type="button" onClick={() => setSelectedDoc(doc)}>{doc.title}</button>
                    <span>{doc.ordinanceNo || 'Walang Ordinance No.'}</span>
                  </div>
                  <div className="knowledge-document-statuses">
                    <Pill color={STATUS_COLOR[doc.status] ?? 'gray'} solid={false}>{ingestionLabel}</Pill>
                    <Pill color={OFFICIAL_COLOR[doc.officialStatus] ?? 'gray'}>{officialLabel}</Pill>
                  </div>
                </div>
                <dl className="knowledge-document-facts">
                  <div><dt>Kategorya</dt><dd>{doc.category || 'Ordinansa'}</dd></div>
                  <div><dt>Petsa ng upload</dt><dd>{doc.dateUploaded || 'Hindi nakatala'}</dd></div>
                  <div><dt>File</dt><dd>{format} <span>/</span> {doc.fileSize ?? '1.2 MB'}</dd></div>
                </dl>
                <footer className="knowledge-document-footer">
                  <button type="button" onClick={() => setSelectedDoc(doc)} className="knowledge-view-action"><Eye size={14} /> Tingnan ang detalye <ChevronRight size={14} /></button>
                  <div className="knowledge-card-actions">
                    {isAdmin && (doc.status === 'Pending' || doc.status === 'Indexing') && <button type="button" onClick={() => handleTriggerIngest(doc)} className="is-primary"><Zap size={13} /> Ingest</button>}
                    {canApprove && doc.officialStatus !== 'Opisyal' && doc.status !== 'Retired' && <button type="button" onClick={() => setPendingApproveDoc(doc)} className="is-publish"><ShieldCheck size={13} /> Publish</button>}
                    {canDelete && doc.status !== 'Retired' && <button type="button" onClick={() => setPendingRetireDoc(doc)} title="I-retire ang dokumento"><Archive size={14} /><span className="sr-only">I-retire</span></button>}
                    {canDelete && <button type="button" onClick={() => setPendingDeleteDoc(doc)} title="Tanggalin ang dokumento" className="is-danger"><Trash2 size={14} /><span className="sr-only">Tanggalin</span></button>}
                  </div>
                </footer>
              </article>
            })}
          </div>
        </section>

        {/* Upload Panel (Authorized Secretary and Admin) */}
        {canUpload && (
          <form
            onSubmit={handleSubmit}
            className="knowledge-upload-panel w-full space-y-2.5 shrink-0"
          >
            <div className="knowledge-upload-heading">
              <span aria-hidden="true"><UploadCloud className="h-4 w-4" /></span>
              <div><h3>Mag-upload ng Dokumento</h3>
              <p>
                Para sa kaalaman ng Barangay-Bot at archival.
              </p></div>
            </div>

            {/* Compliance Warning Notice */}
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-2.5 py-1.5 text-[10px] text-amber-900 flex items-center gap-1.5 leading-snug">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span><strong>Paalala:</strong> Text-searchable PDF o DOCX lamang.</span>
            </div>

            <section className="knowledge-form-stage">
              <div className="knowledge-stage-heading"><span>01</span><div><h4>Document details</h4><p>Pangalan at klasipikasyon ng opisyal na record.</p></div></div>
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
            </section>

            {/* Drag and Drop Box */}
            <section className="knowledge-form-stage">
              <div className="knowledge-stage-heading"><span>02</span><div><h4>Source file</h4><p>Piliin ang searchable document na ii-index.</p></div></div>
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
            </section>

            {/* Full Document Content / Extracted Text Box */}
            <section className="knowledge-form-stage">
              <div className="knowledge-stage-heading"><span>03</span><div><h4>AI-ready content</h4><p>Suriin ang text na gagamitin ng Barangay-Bot.</p></div></div>
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
            </section>

            <button
              type="submit"
              className="knowledge-submit-button"
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
