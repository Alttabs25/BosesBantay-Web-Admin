import './ReportSessionNotes.css'
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
  const venueLines = lines.filter(line => /^Venue:\s*\S/.test(line.trim()))
  const venue = venueLines.at(-1)?.trim().replace(/^Venue:\s*/, '')
  const content = lines.filter(line => !/^Venue:\s*\S/.test(line.trim())).join('\n').trim()
  const author = authorParts.join(' · ')
  const [name, ...role] = author.split(' — ')
  const long = content.length > 280 || content.split('\n').length > 5
  return <article className="blotter-note-entry" aria-label={`Activity ${number}`}>
    <header className="blotter-activity-heading"><div><h4>{status ? 'Hearing record' : venue ? 'Hearing schedule' : 'Staff note'}</h4><time className="blotter-note-date">{date ? date.replace(/(\d{1,2}:\d{2}):\d{2}(?=\s|$)/g, '$1') : 'Date not recorded'}</time></div>{status && <span className={`blotter-activity-status rounded-md px-2 py-1 text-xs font-medium ${tone}`}>{{ Naganap: 'Completed', Ipinagpaliban: 'Postponed', 'Hindi natuloy': 'Not held' }[status]}</span>}</header>
    <div className="blotter-activity-body"><p className={`blotter-note-content whitespace-pre-wrap break-words ${long && !expanded ? 'line-clamp-4' : ''}`}>{content || 'No additional details recorded.'}</p>{long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="blotter-note-expand">{expanded ? 'Show less' : 'Read full note'}</button>}{venue && <dl className="blotter-activity-venue"><dt>Venue</dt><dd>{venue}</dd></dl>}</div>
    <footer className="blotter-activity-footer"><span>Recorded by</span><div><strong>{name || 'Staff not recorded'}</strong>{role.length > 0 && <span>{role.join(' — ')}</span>}</div></footer>
  </article>

}

export default function ReportSessionNotes({ notes }) {
  const [showAll, setShowAll] = useState(false)
  const entries = parseEntries(notes)
  if (!entries.length) return null
  const ordered = entries.map((text, index) => ({ text, number: index + 1 })).reverse()
  const visible = showAll ? ordered : ordered.slice(0, 1)
  return <section className="blotter-session-notes overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="blotter-history-heading"><h3>Activity history <span>{entries.length}</span></h3>{entries.length > 1 && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Show latest' : 'View all'}</button>}</div>
    <div className="blotter-activity-list" role="list" aria-label="Activity history, newest first">{visible.map(({ text, number }, index) => <div role="listitem" key={`${number}:${text}`}><NoteEntry text={text} number={number} latest={index === 0} /></div>)}</div>

  </section>
}
