import { useId, useState } from 'react'
import { CalendarDays, Clock3, Check } from 'lucide-react'

const partsFor = (value) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]))
function inputValues(value) {
  const p = partsFor(value)
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}
const formatSelection = (value) => new Intl.DateTimeFormat('fil-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value))

export default function HearingDateTimePicker({ value, onChange, currentSchedule, onOpenChange, allowPast = false }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState({ date: '', time: '' })
  const [error, setError] = useState('')
  const today = inputValues(Date.now()).date
  const candidate = pending.date && pending.time ? `${pending.date}T${pending.time}:00+08:00` : ''
  const valid = candidate && Number.isFinite(Date.parse(candidate)) && (allowPast || Date.parse(candidate) > Date.now())
  const field = 'cursor-pointer mt-2 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200'
  function begin() {
    setPending(value && Number.isFinite(Date.parse(value)) ? inputValues(value) : { date: today, time: '' })
    setError(''); setOpen(true); onOpenChange?.(true)
  }
  function confirm() {
    if (!valid) { setError(allowPast ? 'Pumili ng kumpletong petsa at oras.' : 'Pumili ng kumpletong petsa at oras sa hinaharap.'); return }
    onChange(new Date(candidate).toISOString()); setOpen(false); onOpenChange?.(false); setError('')
  }
  function openNativePicker(event) {
    const input = event.currentTarget
    input.focus()
    try { input.showPicker?.() } catch { /* Native editing remains available when the browser cannot open a picker. */ }
  }
  return <div>
    <p id={`${id}-label`} className="text-xs font-semibold text-slate-700">Susunod na petsa at oras ng pagdinig</p>
    {currentSchedule && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Kasalukuyan: {formatSelection(currentSchedule)}</p>}
    {!open ? <button type="button" onClick={begin} aria-labelledby={`${id}-label ${id}-value`} aria-expanded={false} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-left hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"><CalendarDays size={19} className="shrink-0 text-bb-blue" /><span className="min-w-0 flex-1"><span id={`${id}-value`} className="block text-sm font-semibold leading-relaxed text-slate-800">{value ? formatSelection(value) : 'Pumili ng petsa at oras'}</span><span className="mt-1 block text-[11px] text-slate-500">{value ? 'Napili na · I-click para baguhin' : 'May hiwalay na OK bago gamitin ang napili'}</span></span></button> : <div className="mt-2 rounded-xl border border-blue-200 bg-slate-50 p-4" role="group" aria-labelledby={`${id}-label`}>
      <div className="mb-4 flex gap-2">{[[0, 'Ngayon'], [1, 'Bukas']].map(([days, text]) => <button key={days} type="button" onClick={() => { setPending((old) => ({ ...old, date: inputValues(Date.now() + days * 86400000).date })); setError('') }} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-300">{text}</button>)}</div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-xs font-semibold text-slate-700"><CalendarDays size={13} className="mr-1 inline" />Petsa<input type="date" onClick={openNativePicker} min={allowPast ? undefined : today} value={pending.date} onChange={(e) => { setPending((old) => ({ ...old, date: e.target.value })); setError('') }} className={field} /></label><label className="min-w-0 text-xs font-semibold text-slate-700"><Clock3 size={13} className="mr-1 inline" />Oras<input type="time" onClick={openNativePicker} value={pending.time} onChange={(e) => { setPending((old) => ({ ...old, time: e.target.value })); setError('') }} className={field} /></label></div>
      <p className="mt-3 rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700" aria-live="polite">{candidate ? formatSelection(candidate) : 'Piliin ang petsa at oras para makita ang buong iskedyul.'}<span className="mt-1 block text-[11px] text-slate-400">Philippine time · Hindi pa naka-save sa report.</span></p>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={() => { setOpen(false); onOpenChange?.(false); setError('') }} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">Kanselahin</button><button type="button" onClick={confirm} className="inline-flex items-center gap-1.5 rounded-lg bg-bb-blue px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Check size={14} />OK, gamitin ito</button></div>
    </div>}
    {value && !open && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Susunod: ilagay ang layunin, suriin ang pagbabago, at kumpirmahing i-save.</p>}
  </div>
}
