import ServiceComplaintActions from './ServiceComplaintActions'
import { useState } from 'react'
import ComplaintLocationMap from './ComplaintLocationMap'
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import Pill from './Pill'
import ReportEvidenceGallery from './ReportEvidenceGallery'
import { STATUS_META } from '../data/mockBlotter'

const text = value => typeof value === 'string' && value.trim() && value !== 'N/A' ? value.trim() : 'Hindi nakatala'
function Status({ report }) {
  return <Pill color={STATUS_META[report.status]?.color || 'gray'} solid>{report.status || 'Hindi nakatala'}</Pill>
}
export default function ServiceComplaintWorkspace({ reports, selectedId, onSelect, onClose, onClear, hasFilters, total }) {
  const [mapReportKey, setMapReportKey] = useState(null)
  const selectedIndex = reports.findIndex(report => report.id === selectedId)
  const selected = reports[selectedIndex]
  const selectedKey = selected ? `${selected.sourceTable}:${selected.dbId || selected.id}` : null
  const mapOpen = mapReportKey === selectedKey
  return <div className={`complaint-workspace mt-4 ${selected ? 'complaint-has-selection' : ''}`}>
    <section className="complaint-list overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Mga service complaint">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3.5"><h2 className="text-sm font-semibold text-slate-900">Mga reklamo</h2><span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] tabular-nums text-slate-500">{reports.length} / {total}</span></div>
      <div className="complaint-scroll">
        {reports.length ? reports.map(report => <button type="button" id={`report-${String(report.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`} key={`${report.sourceTable}:${report.dbId || report.id}`} aria-pressed={selectedId === report.id} onClick={() => onSelect(report)} className={`group block w-full border-b border-slate-100 px-4 py-4 text-left transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${selectedId === report.id ? 'bg-blue-50 shadow-[inset_3px_0_0_#244ca1]' : 'hover:bg-slate-50'}`}>
          <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-xs font-semibold text-bb-blue">{report.id}</span><Status report={report} /></div>
          <h3 className="mt-2 text-sm font-semibold leading-6 text-slate-900">{text(report.title)}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{text(report.excerpt)}</p>
          <p className="mt-2 truncate text-[11px] leading-5 text-slate-500">{text(report.location)}</p>
          <div className="mt-3 flex items-center justify-between gap-2"><span className="text-[11px] text-slate-500">{text(report.datetime)}</span><span className="flex shrink-0 items-center gap-2">{report.photoPaths?.length > 0 && <span className="text-[10px] text-slate-500">{report.photoPaths.length} larawan</span>}<ChevronRight size={15} className="text-slate-400" aria-hidden="true" /></span></div>
        </button>) : <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-slate-800">{total ? 'Walang tumugmang reklamo' : 'Wala pang service complaint'}</p><p className="mt-2 text-xs leading-5 text-slate-500">{total ? 'Subukan ang ibang search o filter.' : 'Lalabas dito ang mga ipinadalang reklamo sa serbisyo.'}</p>{hasFilters && <button type="button" onClick={onClear} className="mt-4 rounded-lg px-3 py-2 text-xs font-semibold text-bb-blue hover:bg-blue-50">I-clear ang filters</button>}</div>}
      </div>
    </section>
    <section className="complaint-detail min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Detalye ng service complaint">
      {selected ? <>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 sm:px-6"><span className="text-xs font-medium text-slate-500">Detalye ng reklamo <span className="ml-2 font-normal tabular-nums">{selectedIndex + 1} / {reports.length}</span></span><div className="flex items-center gap-1"><button type="button" disabled={selectedIndex <= 0} onClick={() => onSelect(reports[selectedIndex - 1])} aria-label="Nakaraang reklamo" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-blue-50 disabled:opacity-30"><ChevronLeft size={16} /></button><button type="button" disabled={selectedIndex >= reports.length - 1} onClick={() => onSelect(reports[selectedIndex + 1])} aria-label="Susunod na reklamo" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-blue-50 disabled:opacity-30"><ChevronRight size={16} /></button></div></div>
        <header className="border-b border-slate-200 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-600 hover:text-bb-blue lg:hidden"><ArrowLeft size={15} /> Mga reklamo</button><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="break-words text-xs font-semibold text-bb-blue">{selected.id}</p><h2 className="mt-2 text-xl font-semibold leading-7 text-slate-900">{text(selected.title)}</h2></div><Status report={selected} /></div></header>
        <div key={`${selected.sourceTable}:${selected.id}`} className="complaint-scroll space-y-6 px-5 py-5 sm:px-6">
          <dl className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Isinumite ni</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{text(selected.filedBy)}</dd></div><div><dt className="text-xs text-slate-500">Petsa ng pagsusumite</dt><dd className="mt-1 text-sm text-slate-900">{text(selected.datetime)}</dd></div></dl>
          <section><h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">Paglalarawan ng problema</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{text(selected.excerpt)}</p></section>
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><MapPin size={16} className="text-slate-500" aria-hidden="true" /> Lokasyon</h3><p className="mt-2 break-words text-sm leading-6 text-slate-700">{text(selected.location)}</p>{Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude) && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3"><span className="text-xs tabular-nums text-slate-500">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</span><button type="button" aria-expanded={mapOpen} onClick={() => setMapReportKey(mapOpen ? null : selectedKey)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-bb-blue hover:bg-blue-50">{mapOpen ? 'Isara ang mapa' : 'Tingnan sa mapa'}</button></div>}{mapOpen && <ComplaintLocationMap key={selectedKey} latitude={selected.latitude} longitude={selected.longitude} />}</section>
          <ServiceComplaintActions key={selectedKey} report={selected} />
          {selected.photoPaths?.length > 0 && <section className="border-t border-slate-200 pt-5"><ReportEvidenceGallery compact paths={selected.photoPaths} reportId={selected.id} /></section>}

        </div>
      </> : <div className="flex min-h-72 flex-1 flex-col items-center justify-center px-8 py-16 text-center"><h2 className="text-base font-semibold text-slate-800">Pumili ng reklamo</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Piliin ang isang ulat para makita ang buong detalye, lokasyon, at mga larawan.</p></div>}
    </section>
  </div>
}
