import { useState } from 'react'

function parseEntries(notes) {
  // Only a recorded timestamp/author starts a new entry. Blank lines inside a
  // resident's or officer's text remain part of that same note.
  const entries = []
  for (const line of notes.split('\n')) {
    if (/^\d.* · \S/.test(line) || !entries.length) entries.push([])
    entries.at(-1).push(line)
  }
  return entries.map((lines) => lines.join('\n').trim()).filter(Boolean)
}

function NoteEntry({ text, number, latest }) {
  const [expanded, setExpanded] = useState(false)
  const lines = text.split('\n')
  const hasHeader = /^\d.* · \S/.test(lines[0] || '')
  const [date, ...authorParts] = hasHeader ? lines.shift().split(' · ') : []
  const last = lines.at(-1)?.trim() || ''
  const status = /^Kalagayan: (Naganap|Ipinagpaliban|Hindi natuloy)$/.test(last) ? lines.pop().trim().slice('Kalagayan: '.length) : ''
  const tone = status === 'Naganap' ? 'bg-emerald-50 text-emerald-700' : status === 'Ipinagpaliban' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
  const content = lines.join('\n').trim()
  const author = authorParts.join(' · ')
  const [name, ...role] = author.split(' — ')
  const long = content.length > 280 || content.split('\n').length > 5
  return <article className="relative py-4 pl-5" aria-label={`Tala ${number}`}>
    <span aria-hidden="true" className={`absolute left-0 top-5 h-2 w-2 rounded-full ${latest ? 'bg-bb-blue ring-4 ring-blue-50' : 'bg-slate-300'}`} />
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0"><h4 className="break-words text-xs font-semibold leading-relaxed text-slate-800">{name || 'Naunang tala'}</h4>{role.length > 0 && <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{role.join(' — ')}</p>}</div>
      {status && <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${tone}`}>{status}</span>}
    </header>
    <p className="mt-1.5 text-[11px] tabular-nums leading-relaxed text-slate-500">{date ? date.replace(/(\d{1,2}:\d{2}):\d{2}(?=\s|$)/g, '$1') : 'Walang nakatalang petsa'}</p>
    <p className={`mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 ${long && !expanded ? 'line-clamp-4' : ''}`}>{content || 'Walang karagdagang detalye.'}</p>
    {long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="mt-1 py-1 text-xs font-medium text-bb-blue">{expanded ? 'Paikliin' : 'Basahin ang buo'}</button>}
  </article>
}

export default function ReportSessionNotes({ notes }) {
  const [showAll, setShowAll] = useState(false)
  const entries = parseEntries(notes)
  if (!entries.length) return null
  const ordered = entries.map((text, index) => ({ text, number: index + 1 })).reverse()
  const visible = showAll ? ordered : ordered.slice(0, 1)
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-semibold text-slate-800">Mga tala</h3><span className="text-[11px] tabular-nums text-slate-400">{entries.length} naitala</span></div>
    <div className="px-4"><ol className="m-0 list-none divide-y divide-slate-100 p-0" style={{ listStyle: 'none' }} aria-label="Mga tala, pinakabago muna">{visible.map(({ text, number }, index) => <li key={`${number}:${text}`} className="list-none"><NoteEntry text={text} number={number} latest={index === 0} /></li>)}</ol></div>
    {entries.length > 1 && <div className="border-t border-slate-100 px-4 py-2"><button type="button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)} className="w-full rounded-lg py-2 text-xs font-semibold text-bb-blue hover:bg-blue-50">{showAll ? 'Ipakita lamang ang pinakahuling tala' : `Tingnan ang lahat (${entries.length})`}</button></div>}
  </section>
}
