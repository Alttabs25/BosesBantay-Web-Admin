import { FileText, ShieldCheck, Hash, X, CheckCircle2, Layers } from 'lucide-react'
import Pill from './Pill'

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

export default function DocumentDetailModal({ open, onClose, doc, onApprove, onRetire, onDelete, canApprove, canDelete }) {
  if (!open || !doc) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-bb-blue">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">{doc.title}</h3>
              <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                <span>{doc.fileFormat ?? 'PDF'}</span>
                <span>•</span>
                <span>{doc.fileSize ?? '1.2 MB'}</span>
                <span>•</span>
                <span>In-upload noong {doc.dateUploaded}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Ordinance / Ref No.</span>
              <span className="font-semibold text-gray-800">{doc.ordinanceNo || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Kategorya</span>
              <span className="font-semibold text-gray-800 truncate block">{doc.category || 'Ordinansa'}</span>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Status ng Pag-apruba</span>
              <Pill color={OFFICIAL_COLOR[doc.officialStatus] ?? 'gray'}>
                {doc.officialStatus === 'Opisyal' ? 'Published' : doc.officialStatus === 'Naghihintay ng Pag-apruba' ? 'Pending Review' : 'Archived'}
              </Pill>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Teknikal na Ingestion</span>
              <Pill color={STATUS_COLOR[doc.status] ?? 'gray'} solid={false}>
                {doc.status === 'Fully Indexed' ? 'Indexed' : doc.status === 'Pending' ? 'Not Indexed' : doc.status}
              </Pill>
            </div>
          </div>

          {/* Technical Compliance Badge */}
          <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <span>
                <strong>Format Compliance:</strong> Machine-readable na teksto ({doc.chunkCount ?? 12} seksyon).
              </span>
            </div>
            <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-blue-700 font-semibold shadow-xs">
              {doc.fileFormat}
            </span>
          </div>

          {/* Summary */}
          {doc.summary && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                Buod ng Dokumento (Executive Summary)
              </h4>
              <p className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 text-sm text-gray-700 leading-relaxed">
                {doc.summary}
              </p>
            </div>
          )}

          {/* Extracted Sections for Barangay-Bot */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-bb-blue" />
              <span>Mga Seksyon na Ginagamit ng Barangay-Bot ({doc.sections?.length || 0})</span>
            </h4>
            {doc.sections && doc.sections.length > 0 ? (
              <div className="space-y-2.5">
                {doc.sections.map((sec, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
                    <h5 className="font-semibold text-gray-800 text-xs text-bb-blue flex items-center gap-1.5 mb-1">
                      <Hash className="h-3 w-3" />
                      {sec.title}
                    </h5>
                    <p className="text-xs text-gray-600 leading-relaxed pl-4 border-l-2 border-bb-blue/30">
                      {sec.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Awtomatikong hinati ang buong teksto sa mga vector chunks para sa semantic search.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-2">
            {canDelete && doc.status !== 'Retired' && (
              <button
                onClick={() => {
                  onClose()
                  onRetire(doc)
                }}
                className="rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100/80 transition-all cursor-pointer"
              >
                I-retire ang Dokumento
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  onClose()
                  onDelete(doc)
                }}
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100/80 transition-all cursor-pointer shadow-xs"
              >
                Tanggalin (Hard Delete)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all cursor-pointer shadow-xs"
            >
              Isara
            </button>
            {canApprove && doc.officialStatus !== 'Opisyal' && doc.status !== 'Retired' && (
              <button
                onClick={() => {
                  onClose()
                  onApprove(doc)
                }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 shadow-sm hover:shadow px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-white" />
                <span>Publish (Gawing Opisyal)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
