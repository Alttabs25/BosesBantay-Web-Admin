import BlotterFinalOutcome from './BlotterFinalOutcome'
import ReportSessionNotes from './ReportSessionNotes'
import Modal from './Modal'
import HearingDateTimePicker from './HearingDateTimePicker'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import BlotterWorkspace from './BlotterWorkspace'
import { hearingVenue, scopedNextActions, scopedPatch, validateScopedAction } from '../lib/scopedBlotterFlow'

export default function ScopedBlotterWorkspace({ report, onFlagSpam }) {
  const { user } = useAuth()
  const { updateBlotterReport, addAuditEntry } = useData()
  const { showToast } = useToast()
  const root = useRef(null)
  const quickFilledNote = useRef('')
  const [action, setAction] = useState('')
  const [draft, setDraft] = useState({ date: '', venue: hearingVenue(report.hearingNote), note: '', outcome: '', confirmed: false, sessionResult: '' })
  const [review, setReview] = useState(false)
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [clock, setClock] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer) }, [])
  const dateTesting = true
  const flow = scopedNextActions(report, clock, { ignoreDateConstraints: dateTesting })
  useLayoutEffect(() => { const resize = () => { if (root.current) root.current.style.setProperty('--scope-height', `${Math.max(350, window.innerHeight - root.current.getBoundingClientRect().top - 24)}px`) }; resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) })
  const actor = [user?.name, user?.role].filter(Boolean).join(' — ')
  const stage = report.status === 'Sinuri' ? 0 : report.status === 'Inimbestigahan' ? 1 : report.status === 'Nareselba' ? 2 : -1
  const resolvedCfa = /certificate to file action|\bcfa\b/i.test(report.outcome || '')
  const input = 'mt-2 block w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200'
  const titles = { review: 'Kumpirmahin ang report', schedule: flow.scheduleLabel || 'Itakda ang pagdinig', note: flow.noteLabel || 'Tala sa pagdinig', past_note: 'Itala ang naunang pagdinig', finalize: 'Itala ang huling resulta' }
  const select = (next) => { setEditingDate(false); setAction(next); setDraft({ date: '', venue: hearingVenue(report.hearingNote), note: '', outcome: '', confirmed: false, sessionResult: '' }); setReview(false); setErrors([]) }
  const change = (key, value) => { setDraft((old) => ({ ...old, [key]: value, ...(key === 'outcome' ? { confirmed: false, ...(old.note === quickFilledNote.current ? { note: '' } : {}) } : {}) })); setReview(false); setErrors([]) }
  async function save(event) {
    event.preventDefault()
    if (editingDate) { setErrors(['Pindutin muna ang OK sa petsa at oras, o kanselahin ang pagpili.']); return }
    const failures = validateScopedAction(action, draft, report, Date.now(), { ignoreDateConstraints: dateTesting })
    if (!actor) failures.push('Mag-sign in muli upang maitala ang opisyal.')
    if (failures.length) { setErrors(failures); return }
    if (!review) { setReview(true); return }
    setSaving(true)
    try {
      await updateBlotterReport(report.id, scopedPatch(action, draft, report, actor))
      addAuditEntry(`${report.id}: ${titles[action]} — ${actor}`, { color: action === 'finalize' ? 'green' : 'blue' })
      showToast('Na-save ang pagbabago sa report.')
      select('')
    } catch { setErrors(['Hindi na-save ang pagbabago. Nananatili ang iyong inilagay; pakisubukan muli.']); setReview(false) }
    finally { setSaving(false) }
  }
  return <div ref={root} className="scoped-blotter-workspace mt-1">
    <section className="scoped-blotter-report min-w-0" aria-label="Kumpletong report"><BlotterWorkspace detailOnly readOnly reports={[]} selectedReport={report} /></section>
    <aside className="scoped-blotter-process space-y-4" aria-label="Pagsusuri at pag-update ng report">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Progreso ng report</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${stage === 2 ? resolvedCfa ? 'bg-violet-50 text-violet-800' : 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-bb-blue'}`}>{stage === 2 ? resolvedCfa ? 'May CFA' : 'Nagkaareglo' : stage === 0 ? 'Sinusuri' : stage === 1 ? 'Isinasagawa' : 'Na-flag'}</span></div><ol className="grid grid-cols-3 px-3 py-5">{['Under Review', 'Investigating', 'Resolved'].map((label, index) => {
  const reached = index <= stage
  const resolved = index === 2 && stage === 2
  const color = resolved ? resolvedCfa ? 'bg-violet-600 text-white ring-violet-100' : 'bg-emerald-600 text-white ring-emerald-100' : reached ? 'bg-bb-blue text-white ring-blue-50' : 'bg-slate-100 text-slate-400 ring-white'
  return <li key={label} aria-current={index === stage ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center gap-3 text-center">
    {index < 2 && <span aria-hidden="true" className={`absolute left-1/2 top-4 h-0.5 w-full ${stage > index ? 'bg-blue-300' : 'bg-slate-200'}`} />}
    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ${color}`}>{index < stage || stage === 2 ? '✓' : index + 1}</span>
    <span className={`px-1 text-[11px] font-semibold leading-snug ${resolved ? resolvedCfa ? 'text-violet-800' : 'text-emerald-800' : reached ? 'text-bb-blue' : 'text-slate-400'}`}>{label}</span>
  </li>
})}</ol></section>
      {report.hearingDate && stage !== 2 && <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="text-xs font-bold text-slate-700">{report.hearingCompleted ? 'Naunang pagdinig' : Date.parse(report.hearingDate) > clock ? 'Nakatakdang pagdinig' : 'Iskedyul na kailangang i-update'}</h3><p className="mt-2 text-sm text-slate-800">{new Date(report.hearingDate).toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}</p><p className="mt-2 text-xs text-slate-500">Venue</p><p className="mt-1 text-sm text-slate-800">{hearingVenue(report.hearingNote) || 'Not specified'}</p></section>}
      <section className="relative rounded-xl border border-slate-200 bg-white p-4"><h3 className={`text-sm font-bold text-slate-900 ${stage === 2 ? 'pr-36' : ''}`}>{stage === 2 ? 'Huling resulta' : 'Susunod na aksyon'}</h3>
        {stage === 0 && <div className="mt-3 space-y-2"><button type="button" onClick={() => select('review')} className="w-full rounded-lg bg-bb-blue px-3 py-2.5 text-xs font-semibold text-white">Suriin at kumpirmahin</button><button type="button" onClick={() => onFlagSpam(report)} className="w-full rounded-lg border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-700">I-review bilang spam</button></div>}
        {stage === 1 && flow.hint && <p className="mt-2 text-xs leading-relaxed text-slate-500">{flow.hint}</p>}{stage === 1 && <div className="mt-3 grid gap-2">{flow.actions.map((value, index) => <button key={value} type="button" aria-pressed={action === value} onClick={() => select(value)} className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left text-xs font-semibold transition-colors ${action === value ? 'border-bb-blue bg-blue-50 text-bb-blue ring-1 ring-blue-100' : !action && index === 0 ? 'border-bb-blue bg-bb-blue text-white hover:bg-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50'}`}><span>{titles[value]}</span><span aria-hidden="true" className="text-base leading-none opacity-70">›</span>{value === 'note' && report.hearingCompleted && <span className="mt-1 block text-[11px] font-normal leading-relaxed text-slate-500">Karagdagang detalye sa huling pagdinig{report.hearingDate ? ` · ${new Date(report.hearingDate).toLocaleDateString('fil-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}` : ''}.</span>}</button>)}</div>}
        {stage === 2 && <BlotterFinalOutcome outcome={report.outcome} />}
      </section>
      {action && flow.actions.includes(action) && stage < 2 && <section className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-bold">{titles[action]}</h3><p className="mt-1 text-[11px] text-slate-500">Nagtatala: {actor}</p><form className="mt-4 space-y-4" onSubmit={save}><fieldset disabled={saving || review} className="space-y-4">
        {action === 'review' && <p className="text-sm leading-relaxed text-slate-600">Kumpirmahing nasuri ang salaysay, impormasyon ng residente at mga sagot sa form. Magiging <strong>Investigating</strong> ang status pagkatapos i-save.</p>}

        {action === 'schedule' && <><HearingDateTimePicker value={draft.date} onChange={(value) => change('date', value)} currentSchedule={report.hearingDate} onOpenChange={setEditingDate} allowPast={dateTesting} /><div><label className="block text-xs font-semibold text-slate-700">Venue<input required maxLength={250} className={input} value={draft.venue} onChange={(e) => change('venue', e.target.value)} placeholder="Building, room, or complete address" autoComplete="off" /></label><div role="group" aria-label="Quick-fill venue" className="mt-2 flex flex-wrap gap-2">{['Barangay Hall', 'Barangay Hall — Meeting Room'].map(venue => <button key={venue} type="button" aria-pressed={draft.venue === venue} onClick={() => change('venue', venue)} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${draft.venue === venue ? 'border-blue-300 bg-blue-50 text-bb-blue' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50'}`}>{venue}</button>)}</div></div></>}
        {action === 'past_note' && <label className="block text-xs font-semibold text-slate-700">Aktuwal na nakaraang petsa at oras<input className={input} type="datetime-local" value={draft.date} onChange={(e) => change('date', e.target.value)} /><span className="mt-1 block text-[11px] font-normal text-slate-500">Para lamang sa pagdinig na aktuwal nang naitala sa barangay; hindi bagong iskedyul.</span></label>}{['note', 'past_note'].includes(action) && <label className="block text-xs font-semibold text-slate-700">Ano ang nangyari sa pagdinig?<select className={input} value={draft.sessionResult} onChange={(e) => change('sessionResult', e.target.value)}><option value="">Pumili</option><option value="held">Naganap</option><option value="postponed">Ipinagpaliban</option><option value="missed">Hindi natuloy</option></select></label>}{action === 'finalize' && <><fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold text-slate-700">Aktuwal na huling resulta</legend>{[['settlement', 'Nagkaareglo', 'May aktuwal na pinirmahang kasunduan.'], ['cfa', 'May naisyung CFA', 'Itatala ang sertipikasyong naisyung opisyal sa labas ng system.']].map(([value, label, help]) => <label key={value} className={`flex items-start gap-2 rounded-lg border p-3 ${draft.outcome === value ? (value === 'settlement' ? 'border-emerald-400 bg-emerald-50' : 'border-violet-400 bg-violet-50') : 'border-slate-200 bg-white hover:bg-slate-50'}`}><input type="radio" name="final-outcome" className="mt-0.5 accent-blue-700" checked={draft.outcome === value} onChange={() => change('outcome', value)} /><span><strong className="block text-xs">{label}</strong><span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{help}</span></span></label>)}</fieldset></>}
        {action !== 'review' && <label className="block text-xs font-semibold text-slate-700">{action === 'schedule' ? 'Layunin / dahilan ng pagbabago' : action === 'finalize' ? 'Maikling detalye ng resulta' : 'Maikling tala sa pagdinig at susunod na hakbang'}<textarea className={input} rows={4} value={draft.note} onChange={(e) => change('note', e.target.value)} placeholder={action === 'note' ? 'Hal. Unang pagpupulong; napag-usapan ang reklamo at napagkasunduang muling magpulong.' : ''} /></label>}
        {action === 'finalize' && draft.outcome && <div className="flex flex-wrap gap-2">{(draft.outcome === 'settlement' ? [
          ['May pinirmahang kasunduan', 'Nagkaareglo ang magkabilang panig at may pinirmahang kasunduan. Mahahalagang detalye: '],
          ['Naayos ang hindi pagkakaunawaan', 'Nagkaareglo ang mga panig tungkol sa reklamo. Mga napagkasunduan: '],
          ['Naitala ang mga obligasyon', 'Nagkaareglo ang mga panig at naitala sa kasunduan ang kanilang mga obligasyon. Mga obligasyon: '],
        ] : [
          ['Naitala ang naisyung CFA', 'Naitala ang aktuwal na naisyung Certificate to File Action (CFA). Reference at petsa ng pag-isyu: '],
          ['May opisyal na sertipikasyon', 'May naisyung CFA matapos ang kaukulang opisyal na proseso. Detalye ng sertipikasyon: '],
        ]).map(([label, text]) => <button key={label} type="button" aria-pressed={draft.note === text} onClick={() => { quickFilledNote.current = text; change('note', text) }} className={`rounded-lg border px-3 py-2 text-left text-xs font-medium ${draft.note === text ? 'border-blue-400 bg-blue-100 text-blue-900' : 'border-blue-200 bg-blue-50 text-bb-blue hover:bg-blue-100'}`}>{label}</button>)}</div>}
        {action === 'finalize' && <div className="space-y-3 border-t border-slate-100 pt-3">{draft.outcome && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-slate-500">Itatalang status:</span><span className="font-semibold text-slate-800">Resolved</span><span className={`rounded-full px-2.5 py-1 font-semibold ${draft.outcome === 'settlement' ? 'bg-emerald-50 text-emerald-800' : 'bg-violet-50 text-violet-800'}`}>{draft.outcome === 'settlement' ? 'Nagkaareglo' : 'May naisyung CFA'}</span></div>}<label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"><input type="checkbox" className="mt-0.5 shrink-0 accent-blue-700" checked={draft.confirmed} onChange={(e) => change('confirmed', e.target.checked)} /><span>Nabeberipika ko ang aktuwal na resultang itinatala.</span></label></div>}
        {['note', 'past_note'].includes(action) && draft.sessionResult && <div><div className="mt-2 flex flex-wrap gap-2">{({
          held: [
            ['Napakinggan ang mga panig', 'Naganap ang pagdinig at napakinggan ang paliwanag ng magkabilang panig. Susunod na hakbang: '],
            ['May kailangang linawin', 'Naganap ang pagdinig. May mga detalye pang kailangang linawin bago makapagpatuloy. Mga detalye at susunod na hakbang: '],
            ['Ipagpapatuloy ang pag-uusap', 'Naganap ang pagdinig at ipagpapatuloy ang pag-uusap sa susunod na pagpupulong. Mga napag-usapan: '],
          ],
          postponed: [
            ['Hiling na pagpapaliban', 'Ipinagpaliban ang pagdinig ayon sa kahilingan ng panig. Dahilan at susunod na hakbang: '],
            ['Hindi makadalo ang panig', 'Ipinagpaliban ang pagdinig dahil hindi makadadalo ang isa sa mga panig. Panig, dahilan at susunod na hakbang: '],
            ['Kailangang muling itakda', 'Ipinagpaliban ang pagdinig at kailangang magtakda ng bagong iskedyul. Dahilan: '],
          ],
          missed: [
            ['Wala ang nagrereklamo', 'Hindi natuloy ang pagdinig dahil hindi dumalo ang nagrereklamo. Naitalang dahilan at susunod na hakbang: '],
            ['Wala ang inirereklamo', 'Hindi natuloy ang pagdinig dahil hindi dumalo ang inirereklamo. Naitalang dahilan at susunod na hakbang: '],
            ['Parehong hindi dumalo', 'Hindi natuloy ang pagdinig dahil parehong hindi dumalo ang mga panig. Naitalang detalye at susunod na hakbang: '],
          ],
        }[draft.sessionResult] || []).map(([label, text]) => <button key={label} type="button" aria-pressed={draft.note === text} onClick={() => { quickFilledNote.current = text; change('note', text) }} className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${draft.note === text ? 'border-blue-400 bg-blue-100 text-blue-900' : 'border-blue-200 bg-blue-50 text-bb-blue hover:border-blue-400 hover:bg-blue-100'}`}>{label}</button>)}</div></div>}
        {action === 'schedule' && <div><p className="text-xs font-semibold text-slate-700">Karaniwang layunin</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Pumili para punan ang layunin. Maaari mo itong baguhin o dagdagan.</p><div className="mt-2 flex flex-wrap gap-2">{(report.hearingCompleted ? [
          ['Ipagpatuloy ang pag-uusap', 'Ipagpatuloy ang pag-uusap tungkol sa reklamo at mga usaping hindi pa nalulutas.'],
          ['Linawin ang mga detalye', 'Linawin ang mga detalye ng reklamo at pakinggan ang karagdagang paliwanag ng mga panig.'],
          ['Pag-usapan ang kasunduan', 'Pag-usapan ang mga mungkahing kasunduan at susunod na hakbang.'],
        ] : report.hearingDate ? [
          ['Hiling na bagong iskedyul', 'Baguhin ang iskedyul ng pagdinig ayon sa kahilingan ng panig. Dahilan: '],
          ['Hindi matutuloy ang iskedyul', 'Muling itakda ang pagdinig dahil hindi matutuloy ang naunang iskedyul. Dahilan: '],
          ['Bagong petsa ng pag-uusap', 'Itakda ang bagong petsa upang mapag-usapan ang reklamo. Dahilan ng pagbabago: '],
        ] : [
          ['Pakinggan ang magkabilang panig', 'Unang pagdinig upang pakinggan ang salaysay at paliwanag ng magkabilang panig.'],
          ['Linawin ang reklamo', 'Unang pagdinig upang linawin ang reklamo at mga kaugnay na detalye.'],
          ['Pag-usapan ang pag-aayos', 'Unang pagdinig upang mapag-usapan ang posibleng pag-aayos ng hindi pagkakaunawaan.'],
        ]).map(([label, text]) => <button key={label} type="button" aria-pressed={draft.note === text} onClick={() => { quickFilledNote.current = text; change('note', text) }} className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${draft.note === text ? 'border-blue-400 bg-blue-100 text-blue-900' : 'border-blue-200 bg-blue-50 text-bb-blue hover:border-blue-400 hover:bg-blue-100'}`}>{label}</button>)}</div></div>}

      </fieldset>{errors.length > 0 && <ul role="alert" className="rounded-lg bg-red-50 p-3 text-xs leading-relaxed text-red-700">{errors.map((message) => <li key={message}>{message}</li>)}</ul>}<div className="flex gap-2"><button disabled={saving || editingDate} className="flex-1 rounded-lg bg-bb-blue px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Sine-save…' : action === 'schedule' ? 'I-save ang iskedyul' : action === 'review' ? 'Kumpirmahin' : 'I-record'}</button><button type="button" disabled={saving} onClick={() => select('')} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">Kanselahin</button></div></form></section>}

      {report.hearingNote && <ReportSessionNotes notes={report.hearingNote} />}

    </aside>
    <Modal open={review} onClose={() => { if (!saving) setReview(false) }} title={action === 'schedule' ? 'I-save ang iskedyul?' : action === 'review' ? 'Kumpirmahin ang report?' : 'I-record ang tala?'} maxWidth="max-w-md">
      <div role="dialog" aria-label="Kumpirmasyon ng pag-save" aria-modal="true">
        <p className="text-sm leading-relaxed text-slate-600">{action === 'review' ? 'Ililipat ang report sa Investigating.' : action === 'finalize' ? `Isasara ang report bilang ${draft.outcome === 'settlement' ? 'Nagkaareglo' : 'May naisyung CFA'}.` : action === 'schedule' ? new Date(draft.date || Date.now()).toLocaleString('fil-PH', { timeZone: 'Asia/Manila' }) : 'Ire-record ang napiling kalagayan at tala ng pagdinig.'}</p>
        {action === 'schedule' && <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">Venue</p><p className="mt-1 text-sm text-slate-800">{draft.venue}</p></div>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setReview(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">Kanselahin</button><button type="button" disabled={saving} onClick={save} className="rounded-lg bg-bb-blue px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Sine-save…' : action === 'schedule' ? 'I-save' : action === 'review' ? 'Kumpirmahin' : 'I-record'}</button></div>
      </div>
    </Modal>
  </div>
}
