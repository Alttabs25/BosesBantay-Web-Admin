import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import Modal from './Modal'

const stages = { received: 'Received · for review', in_progress: 'In progress', follow_up: 'Needs follow-up', resolved: 'Resolved', closed_unresolved: 'Closed · not resolved' }
const actions = { start: 'Kumpirmahin at simulan', note: 'Mag-record ng update', follow_up: 'Kailangan ng follow-up', resolve: 'Mark as resolved', close_unresolved: 'Close without resolution', reopen: 'Reopen complaint' }
const staffRoles = ['Barangay Secretary','Barangay Captain','Punong Barangay','System Administrator','Lupon Member','Lupong Tagapamayapa Member']
function initialStage(status) {
  if (['resolved','nareselba','completed'].includes(status?.toLowerCase())) return 'resolved'
  if (['closed','cancelled','canceled'].includes(status?.toLowerCase())) return 'closed_unresolved'
  return ['investigating','inimbestigahan','in progress','assigned','processing'].includes(status?.toLowerCase()) ? 'in_progress' : 'received'
}
export default function ServiceComplaintActions({ report }) {
  const { user } = useAuth()
  const { fetchData } = useData()
  const { showToast } = useToast()
  const source = report.sourceTable
  const reportId = String(report.dbId || '')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  const request = useRef(null)
  const expectedLast = useRef(null)
  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error: failure } = await supabase.from('bb_service_events').select('*').eq('source_table', source).eq('report_id', reportId).order('created_at', { ascending: false }).order('id', { ascending: false })
      if (!active) return
      if (failure) setError('Hindi ma-load ang action history. Subukan muli bago mag-save.')
      else { setEvents(data || []); setError('') }
      setLoading(false)
    }
    void load().catch(() => { if (active) { setError('Hindi makakonekta sa server. Subukan muli.'); setLoading(false) } })
    const channel = supabase.channel(`service-history:${source}:${reportId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bb_service_events', filter: `report_id=eq.${reportId}` }, () => { void load() }).subscribe(status => { if (status === 'SUBSCRIBED') void load() })
    return () => { active = false; void supabase.removeChannel(channel) }
  }, [source, reportId, retry])
  const latest = events[0]
  const stage = latest?.stage || initialStage(report.status)
  const closed = ['resolved','closed_unresolved'].includes(stage)
  const available = closed ? ['reopen'] : stage === 'received' ? ['start','close_unresolved'] : ['note','follow_up','resolve','close_unresolved']
  const canSave = staffRoles.includes(user?.role) && reportId && ['reports','service_complaints'].includes(source)
  async function save() {
    if (saving || !canSave || error || !note.trim() || !available.includes(action)) return
    setSaving(true)
    try {
      if (!request.current) request.current = crypto.randomUUID()
      const { data, error: failure } = await supabase.rpc('save_service_complaint_action', { p_source: source, p_report_id: reportId, p_action: action, p_note: note.trim(), p_request_id: request.current, p_expected_last: expectedLast.current })
      if (failure) throw failure
      const saved = Array.isArray(data) ? data[0] : data
      if (!saved?.id) throw new Error('Save not confirmed')
      setEvents(previous => [saved, ...previous.filter(event => event.id !== saved.id)].sort((a,b) => b.created_at.localeCompare(a.created_at)))
      setAction(''); setNote(''); request.current = null; setConfirm(false)
      showToast('Na-save ang update sa service complaint.')
      void fetchData().catch(() => showToast('Na-save ang update. I-reload ang listahan para sa bagong status.', 'error'))
    } catch (failure) {
      console.warn('[service-action] save failed', failure)
      setConfirm(false)
      showToast('Hindi nakumpirma ang save. Nananatili ang note mo. Subukan muli o i-reload kung may ibang staff na nag-update.', 'error')
    } finally { setSaving(false) }
  }
  return <section className="border-t border-slate-200 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-900">Progress at actions</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${stage === 'resolved' ? 'bg-emerald-50 text-emerald-800' : stage === 'closed_unresolved' ? 'bg-slate-100 text-slate-700' : stage === 'follow_up' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-bb-blue'}`}>{stages[stage]}</span></div>
    <ol className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">{['Received','In progress',closed ? stage === 'resolved' ? 'Resolved' : 'Closed · unresolved' : 'Completion'].map((label,index) => <li key={index} className={`border-t-2 px-1 pt-2 ${index === 0 || index === 1 && stage !== 'received' || index === 2 && closed ? 'border-blue-500 font-medium text-slate-800' : 'border-slate-200 text-slate-400'}`}>{label}</li>)}</ol>
    {loading ? <p className="mt-4 text-xs text-slate-500">Loading history…</p> : error ? <div role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{error}<button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1) }} className="ml-2 underline">Retry</button></div> : canSave ? <form onSubmit={event => { event.preventDefault(); if (note.trim() && available.includes(action)) setConfirm(true) }} className="mt-5 space-y-3">
      <label className="block text-xs font-medium text-slate-600">Next action<select required disabled={saving} value={action} onChange={event => { setAction(event.target.value); expectedLast.current = latest?.id || null; request.current = null }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"><option value="">Pumili ng action</option>{available.map(value => <option key={value} value={value}>{actions[value]}</option>)}</select></label>
      {action && <><label className="block text-xs font-medium text-slate-600">{action === 'resolve' ? 'Ano ang ginawa para ma-resolve?' : action === 'close_unresolved' ? 'Bakit isinasara nang hindi resolved? Ilagay ang referral o next step.' : action === 'reopen' ? 'Dahilan ng reopening' : 'Tala / ginawa at susunod na hakbang'}<textarea required maxLength={4000} disabled={saving} value={note} onChange={event => { setNote(event.target.value); request.current = null }} rows={4} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-6 text-slate-900" /></label><p className="text-xs leading-5 text-slate-500">Makikita ng nagsumite ang note na ito sa notification.</p><button disabled={saving || !note.trim()} className="rounded-lg bg-bb-blue px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'I-record ang action'}</button></>}
    </form> : null}
    <details className="mt-5 border-t border-slate-200 pt-4" open><summary className="cursor-pointer text-sm font-semibold text-slate-800">Activity history <span className="ml-1 text-xs font-normal text-slate-500">({events.length})</span></summary><ol className="mt-3 divide-y divide-slate-100">{events.map(event => <li key={event.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><h4 className="text-xs font-semibold text-slate-800">{actions[event.action]}</h4><time className="text-[11px] text-slate-500">{new Date(event.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{event.note}</p><p className="mt-2 text-[11px] text-slate-500">{event.actor_name} · {event.actor_role}</p></li>)}</ol>{!loading && !events.length && !error && <p className="mt-3 text-xs text-slate-500">Wala pang recorded staff action. Hindi kasama rito ang dating updates bago na-enable ang history.</p>}</details>
    <Modal open={confirm} onClose={() => { if (!saving) setConfirm(false) }} title={actions[action] || 'I-record ang action'} maxWidth="max-w-md"><p className="text-sm text-slate-600">{report.id}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{note}</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setConfirm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs">Back</button><button type="button" disabled={saving} onClick={save} className="rounded-lg bg-bb-blue px-4 py-2 text-xs font-semibold text-white">{saving ? 'Saving…' : 'Confirm and save'}</button></div></Modal>
  </section>
}
