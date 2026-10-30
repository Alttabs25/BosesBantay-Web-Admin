import { CheckCircle2, FileCheck2 } from 'lucide-react'

export default function BlotterFinalOutcome({ outcome }) {
  const raw = String(outcome || '').trim()
  const cfa = /certificate to file action|\bcfa\b/i.test(raw)
  const settled = !cfa && /settlement|settled|nagkaareglo|kasunduan/i.test(raw)
  const title = cfa ? 'CFA recorded' : settled ? 'Settled' : 'Outcome not recorded'
  const details = raw.replace(/^(?:Settlement\s*[—–-]\s*Nagkaareglo|Certificate to File Action\s*\(CFA\)\s*[—–-]\s*naisyung sertipikasyon)\s*/i, '').trim()
  const tone = cfa ? 'bg-violet-50 text-violet-800' : settled ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-700'
  const Icon = cfa ? FileCheck2 : CheckCircle2
  return <div className="mt-3">
    <div className="absolute right-4 top-3.5"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${tone}`}><Icon size={14} className="shrink-0" aria-hidden="true" />{title}</span></div>
    <div className="mt-4 border-t border-slate-100 pt-3"><h4 className="text-xs font-medium text-slate-500">{settled ? 'Naitalang pag-aayos' : cfa ? 'Naitalang sertipikasyon' : 'Naitalang detalye'}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{details || 'Walang karagdagang detalyeng naitala.'}</p></div>
  </div>
}
