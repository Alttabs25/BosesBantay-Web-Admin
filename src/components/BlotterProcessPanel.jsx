import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'

const ACTIONS = {
  schedule: 'Magtakda / baguhin ang pagdinig',
  notice: 'Itala ang summons / abiso',
  session: 'Itala ang nangyari sa pagdinig',
  pangkat: 'Itala ang pagbuo / referral sa Pangkat',
  settlement: 'Itala ang nagkaareglo',
  cfa: 'Itala ang aktuwal na CFA',
  followup: 'Itala ang follow-up / repudiation / pagsunod',
}
const fresh = () => ({ action: 'schedule', stage: 'Mediation sa Punong Barangay', date: '', actualDate: '', venue: 'Barangay Hall', officer: '', notes: '', attendance: '', result: '', reference: '', acknowledged: false })
const displayDate = (value) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('fil-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Hindi nakatala'

export function validateProcess(draft, report, canConfirm, canManage) {
  const errors = []
  const close = ['settlement', 'cfa'].includes(draft.action)
  if (close ? !canConfirm : !canManage) errors.push('Wala kang pahintulot para sa aksyong ito.')
  if (report.status !== 'Inimbestigahan' && draft.action !== 'followup') errors.push('Kailangang nasa imbestigasyon ang ulat.')
  if (!draft.officer.trim()) errors.push('Hindi makuha ang opisyal mula sa account. Mag-sign in muli.')
  if (!draft.notes.trim()) errors.push('Maglagay ng malinaw na tala at susunod na hakbang.')
  if (draft.action === 'schedule') {
    if (!draft.date || !Number.isFinite(Date.parse(draft.date)) || Date.parse(draft.date) <= Date.now()) errors.push('Pumili ng petsa at oras sa hinaharap.')
    if (!draft.venue.trim()) errors.push('Ilagay ang lugar ng pagdinig.')
  } else if (!draft.actualDate || !Number.isFinite(Date.parse(draft.actualDate)) || Date.parse(draft.actualDate) > Date.now()) errors.push('Ilagay ang aktuwal na petsa at oras; hindi ito maaaring nasa hinaharap.')
  if (draft.action === 'session') {
    if (!report.hearingDate) errors.push('Magtala muna ng iskedyul ng pagdinig.')
    if (!draft.attendance || !draft.result) errors.push('Piliin ang attendance at resulta ng session.')
    if (draft.attendance !== 'Parehong panig ay dumalo' && draft.result === 'Naganap ang pag-uusap') errors.push('Hindi maaaring itala ang pag-uusap ng magkabilang panig kung hindi pareho ang dumalo.')
  }
  if (['notice', 'pangkat', 'settlement', 'cfa'].includes(draft.action) && !draft.reference.trim()) errors.push('Ilagay ang reference ng dokumento o opisyal na tala.')
  if (close && !report.hearingCompleted && !draft.acknowledged) errors.push('Kumpirmahin ang dokumentadong batayan ng resulta kahit walang completed session sa app.')
  if (close && !draft.acknowledged) errors.push('Kumpirmahin ang beripikasyon ng dokumento at naaangkop na proseso.')
  return [...new Set(errors)]
}

export default function BlotterProcessPanel({ report, canConfirm, canManageInvestigation }) {
  const { updateBlotterReport, addAuditEntry } = useData()
  const { showToast } = useToast()
  const { user } = useAuth()
  const officer = user?.name && user?.role ? [user.name, user.role].join(' — ') : ''
  const [draft, setDraft] = useState(() => ({ ...fresh(), action: ['Nareselba', 'Resolved'].includes(report.status) ? 'followup' : canManageInvestigation ? 'schedule' : 'settlement' }))
  const [errors, setErrors] = useState([])
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (key, value) => { setDraft((old) => ({ ...old, [key]: value })); setReview(false); setErrors([]) }
  const closed = ['Nareselba', 'Resolved'].includes(report.status)
  const available = Object.entries(ACTIONS).filter(([key]) => closed ? key === 'followup' && canManageInvestigation : ['settlement', 'cfa'].includes(key) ? canConfirm : canManageInvestigation)
  const action = draft.action
  const needsReference = ['notice', 'pangkat', 'settlement', 'cfa'].includes(action)
  const closing = ['settlement', 'cfa'].includes(action)
  const input = 'mt-1.5 block w-full min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900'
  const label = 'block text-xs font-semibold text-gray-700'
  async function save() {
    const validation = validateProcess({ ...draft, officer }, report, canConfirm, canManageInvestigation)
    if (validation.length) { setErrors(validation); setReview(false); return }
    if (!review) { setReview(true); return }
    setSaving(true)
    try {
      const event = [
        `[${displayDate(new Date().toISOString())}] ${ACTIONS[action]}`,
        `Yugto: ${draft.stage}`,
        `Petsa: ${displayDate(action === 'schedule' ? draft.date : draft.actualDate)}`,
        `Opisyal: ${officer.trim()}`,
        action === 'schedule' && `Lugar: ${draft.venue.trim()}`,
        action === 'session' && `Attendance: ${draft.attendance}; Resulta: ${draft.result}`,
        needsReference && `Dokumento / tala: ${draft.reference.trim()}`,
        `Tala: ${draft.notes.trim()}`,
      ].filter(Boolean).join('\n')
      const patch = { hearingNote: [report.hearingNote, event].filter(Boolean).join('\n\n──────────\n\n') }
      if (action === 'schedule') Object.assign(patch, { hearingDate: new Date(draft.date).toISOString(), hearingCompleted: false })
      if (action === 'session') patch.hearingCompleted = draft.attendance === 'Parehong panig ay dumalo' && draft.result === 'Naganap ang pag-uusap'
      if (closing) Object.assign(patch, { status: 'Nareselba', outcome: `${action === 'settlement' ? 'Settlement — Nagkaareglo' : 'Certificate to File Action (CFA)'}\nDokumento: ${draft.reference.trim()}\nOpisyal: ${officer.trim()}\nPetsa: ${displayDate(draft.actualDate)}\n${draft.notes.trim()}` })
      await updateBlotterReport(report.id, patch)
      addAuditEntry(`${report.id}: ${ACTIONS[action]}`, { color: closing ? 'green' : 'blue' })
      showToast('Na-save ang tala at na-update ang proseso.')
      setDraft({ ...fresh(), action: closed ? 'followup' : canManageInvestigation ? 'schedule' : 'settlement' }); setReview(false)
    } catch (error) { console.error('Blotter process save failed:', error); setErrors(['Hindi na-save ang tala. Nananatili ang iyong inilagay; pakisubukan muli.']) }
    finally { setSaving(false) }
  }
  return <section className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-label="Pamamahala ng proseso">
    <h4 className="text-sm font-bold text-gray-900">{closed ? 'Follow-up sa isinara na kaso' : 'Susunod na hakbang'}</h4>
    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-gray-600"><strong className="block text-gray-800">Kasalukuyang pagdinig</strong>{report.hearingDate ? displayDate(report.hearingDate) : 'Wala pang iskedyul'}<span className="mt-1 block">{report.hearingCompleted ? 'May naitalang pag-uusap. Maaaring mag-follow-up o magtala ng dokumentadong resulta.' : 'Hindi pa nakumpirma ang pag-uusap ng magkabilang panig.'}</span></div>
    {available.length > 0 ? <form className="mt-4 space-y-4" onSubmit={(event) => { event.preventDefault(); save() }}>
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
      <label className={label}>Aksyon<select className={input} value={closed ? 'followup' : action} onChange={(e) => set('action', e.target.value)}>{available.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
      <label className={label}>Yugto<select className={input} value={draft.stage} onChange={(e) => set('stage', e.target.value)}>{['Mediation sa Punong Barangay', 'Conciliation sa Pangkat', 'Follow-up / pagpapatupad'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className={label}>{action === 'schedule' ? 'Petsa at oras ng susunod na pagdinig' : 'Aktuwal na petsa at oras'}<input type="datetime-local" className={input} value={action === 'schedule' ? draft.date : draft.actualDate} onChange={(e) => set(action === 'schedule' ? 'date' : 'actualDate', e.target.value)} /></label>
      {action === 'schedule' && <label className={label}>Lugar<input className={input} value={draft.venue} onChange={(e) => set('venue', e.target.value)} /></label>}
      <label className={label}>Opisyal at tungkulin<input className={input} value={officer} readOnly aria-readonly="true" placeholder="Hindi makuha ang kasalukuyang opisyal" /></label>
      {action === 'session' && <><label className={label}>Attendance<select className={input} value={draft.attendance} onChange={(e) => set('attendance', e.target.value)}><option value="">Pumili</option>{['Parehong panig ay dumalo', 'Hindi dumalo ang nagrereklamo', 'Hindi dumalo ang inirereklamo', 'Parehong hindi dumalo'].map((value) => <option key={value}>{value}</option>)}</select></label><label className={label}>Resulta ng session<select className={input} value={draft.result} onChange={(e) => set('result', e.target.value)}><option value="">Pumili</option>{['Naganap ang pag-uusap', 'Ipinagpaliban', 'Hindi natuloy'].map((value) => <option key={value}>{value}</option>)}</select></label></>}
      {needsReference && <label className={label}>Reference ng dokumento / opisyal na tala<input className={input} value={draft.reference} onChange={(e) => set('reference', e.target.value)} placeholder={action === 'notice' ? 'Summons, paraan at patunay ng paghahatid' : action === 'pangkat' ? 'Tala ng pagbuo, mga miyembro at referral' : 'Numero / file reference ng pinirmahang dokumento'} /></label>}
      <label className={label}>Detalye at susunod na hakbang<textarea className={input} rows={4} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder={action === 'session' ? 'Mga dumalo, napag-usapan, kasunduan o dahilan ng hindi pagtuloy, at susunod na hakbang.' : action === 'schedule' ? 'Layunin; dahilan kung reschedule. Ang dating tala ay mananatili.' : 'Itala ang ginawa, batayan, at susunod na hakbang.'} /></label>
      {closing && <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-700"><input type="checkbox" className="mt-1" checked={draft.acknowledged} onChange={(e) => set('acknowledged', e.target.checked)} /><span>{action === 'settlement' ? 'Naberipika ang nakasulat, pinirmahan, at pinatunayang kasunduan. Itatala rin ang anumang repudiation o follow-up.' : 'Naberipika ng awtorisadong opisyal ang aktuwal na CFA at naaangkop na batayan at proseso.'}</span></label>}
      </fieldset>
      {errors.length > 0 && <ul role="alert" className="space-y-1 rounded-lg bg-red-50 p-3 text-xs text-red-700">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      {review && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed"><strong className="block">Kumpirmahin ang tala</strong>{ACTIONS[action]} · {draft.stage}<p className="mt-1">{displayDate(action === 'schedule' ? draft.date : draft.actualDate)} · {officer}</p><p className="mt-1 whitespace-pre-wrap">{draft.notes}</p>{closing && <p className="mt-2 font-bold">Isasara bilang {action === 'settlement' ? 'Nagkaareglo' : 'May CFA'} · {draft.reference}</p>}<button type="button" className="mt-2 font-semibold underline" onClick={() => setReview(false)}>Bumalik at suriin</button></div>}
      <button disabled={saving} className="w-full rounded-lg bg-bb-blue px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Sine-save…' : review ? 'Kumpirmahin at i-save' : 'Suriin ang tala'}</button>
    </form> : <p className="mt-3 text-xs text-gray-500">Pagtingin lamang. Ang awtorisadong kawani ang magtatala ng susunod na hakbang.</p>}
    <details className="mt-4 border-t border-gray-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-gray-700">Kasaysayan ng proseso</summary><p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600">{report.hearingNote || 'Wala pang naitalang proseso.'}</p></details>
    <p className="mt-4 text-[11px] leading-relaxed text-gray-500">Pagtatala lamang: hindi awtomatikong naghahatid ng summons o nag-iisyu ng CFA. Ang opisyal ang tumitiyak sa hurisdiksyon, mga deadline, at legal na batayan.</p>
  </section>
}
