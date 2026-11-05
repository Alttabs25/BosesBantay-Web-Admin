import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { ROLES } from '../config/permissions'

export default function CommitteeAssignment({ report }) {
  const { user, committees } = useAuth()
  const { assignRecordCommittee } = useData()
  const { showToast } = useToast()
  const [committeeId, setCommitteeId] = useState(String(report?.committeeId || ''))
  const [saving, setSaving] = useState(false)
  useEffect(() => setCommitteeId(String(report?.committeeId || '')), [report?.committeeId])
  if (user?.role !== ROLES.ADMIN) return null

  async function save() {
    setSaving(true)
    const result = await assignRecordCommittee(report, committeeId || null)
    setSaving(false)
    if (!result?.success) return showToast(result?.error || 'Hindi na-save ang committee tag.', 'error')
    showToast('Na-save ang committee scope ng record.')
  }

  const unchanged = String(report?.committeeId || '') === committeeId
  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="text-sm font-bold text-slate-900">Committee scope</h3>
    <p className="mt-1 text-xs leading-5 text-slate-500">Kagawad na nakatalaga sa komiteng ito lamang ang makakakita sa record.</p>
    <select value={committeeId} onChange={(event) => setCommitteeId(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs">
      <option value="">Unassigned</option>
      {(committees || []).map(committee => <option key={committee.committee_id} value={committee.committee_id}>{committee.committee_id} — {committee.committee_name}</option>)}
    </select>
    <button type="button" disabled={saving || unchanged} onClick={save} className="mt-2 w-full rounded-lg bg-bb-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save committee'}</button>
  </section>
}
