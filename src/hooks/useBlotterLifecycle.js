import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { projectCase } from '../lib/blotterLifecycle'

export default function useBlotterLifecycle(report) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(null)
  const source = report.sourceTable || (report.isFormReport ? 'reports' : 'pre_blotters')
  const identity = `${source}:${report.id}`
  const identityRef = useRef(identity)
  identityRef.current = identity
  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const rows = []
      for (let from = 0; ; from += 500) {
        const { data, error: queryError } = await supabase.from('bb_blotter_events').select('*').eq('source_table', source).eq('reference_no', report.id).order('sequence').range(from, from + 499)
        if (queryError) throw queryError
        rows.push(...data)
        if (data.length < 500) break
      }
      if (identityRef.current === identity) setEvents(rows)
      return rows
    } catch (failure) {
      if (identityRef.current === identity) setError(['42P01', 'PGRST205'].includes(failure.code) ? 'Hindi pa naka-install ang case lifecycle database migration. Available pa rin ang orihinal na ulat; naka-disable ang bagong proseso hanggang ma-install ito.' : 'Hindi ma-load ang case history. Subukang muli; walang ipinapalagay na progreso.')
      throw failure
    } finally { if (identityRef.current === identity) setLoading(false) }
  }, [source, report.id, identity])
  useEffect(() => { setEvents([]); pending.current = null; reload().catch(() => {}) }, [reload])
  async function record(kind, payload) {
    if (saving) return
    setSaving(true)
    const signature = JSON.stringify({ identity, kind, payload })
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() }
    try {
      const { error: rpcError } = await supabase.rpc('bb_record_case_event', { p_source: source, p_ref: report.id, p_kind: kind, p_payload: payload, p_version: events.length, p_request_id: pending.current.id })
      if (rpcError) {
        if (rpcError.code === '40001') await reload()
        throw rpcError
      }
      await reload()
      pending.current = null
    } finally { setSaving(false) }
  }
  return { events, state: projectCase(events), loading, error, saving, reload, record }
}
