export const PROCEDURE_COPY = {
  mediation: { title: 'Mediation sa Punong Barangay', presiding: 'Punong Barangay / presiding official', agenda: 'Mga usaping nais pag-usapan', discussion: 'Pag-uusap at mga mungkahing pag-aayos', agreements: 'Mga puntong pinagkasunduan / proposed settlement', help: 'Itala ang salaysay ng dalawang panig at mga mungkahing pag-aayos. Hiwalay na itatala ang pinirmahang kasunduan.' },
  conciliation: { title: 'Pangkat conciliation', presiding: 'Pangkat chairperson / presiding official', agenda: 'Mga isyung hindi nalutas sa mediation', discussion: 'Conciliation discussion at paglilinaw ng Pangkat', agreements: 'Mga puntong pinagkasunduan sa Pangkat', help: 'Iugnay ang session sa naitalang Pangkat. Itala ang mga dumalong miyembro, usaping hindi nalutas at rekomendadong hakbang.' },
  arbitration: { title: 'Arbitration', presiding: 'Napagkasunduang arbitrator / presiding official', agenda: 'Mga isyung sakop ng written arbitration agreement', discussion: 'Mga pahayag at usaping isinumite sa arbitrator', agreements: 'Mga stipulation / puntong pinagkaisahan', help: 'Batay sa naitalang written arbitration agreement. Ang minutes ay hindi awtomatikong arbitration award.' },
}
export const localDateInput = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function initialProcessDraft(kind, state, meetingId) {
  const meeting = state.meetings.find((m) => m.meeting_id === meetingId) || (['meeting_recorded', 'meeting_rescheduled'].includes(kind) ? state.meetings.find((m) => m.status === 'scheduled') : null)
  const type = meeting?.type || (state.stage === 'conciliation' ? 'conciliation' : state.stage === 'arbitration' ? 'arbitration' : 'mediation')
  return { notes: '', occurred_at: localDateInput(new Date().toISOString()), approved: false, meeting_id: meeting?.meeting_id || meetingId || '', type, venue: meeting?.venue || 'Barangay Hall', actual_venue: meeting?.venue || 'Barangay Hall', presiding: meeting?.presiding || state.assignment?.assigned_name || '', agenda: meeting?.agenda || '', participants: meeting?.participants || '', scheduled_at: kind === 'meeting_rescheduled' ? localDateInput(meeting?.scheduled_at) : '', ends_at: kind === 'meeting_rescheduled' ? localDateInput(meeting?.ends_at) : '', status: '', outcome: '' }
}
export function changeProcessDraft(old, key, value, kind, state) {
  if (key === 'meeting_id' && ['meeting_recorded', 'meeting_rescheduled'].includes(kind)) return { ...initialProcessDraft(kind, state, value), meeting_id: value }
  const next = { ...old, [key]: value, approved: key === 'approved' ? value : false }
  if (key === 'scheduled_at' && Number.isFinite(Date.parse(value))) {
    const duration = Math.max(0, Date.parse(old.ends_at) - Date.parse(old.scheduled_at)) || 3600000
    next.ends_at = localDateInput(new Date(Date.parse(value) + duration).toISOString())
  }
  if (key === 'attendance' && value !== 'both') { next.status = 'missed'; next.outcome = 'pending' }
  if (key === 'attendance' && value === 'both' && old.status === 'missed') { next.status = ''; next.outcome = '' }
  return next
}
export function prepareProcessPayload(draft, kind) {
  const payload = { ...draft }
  if (kind === 'meeting_recorded' && draft.status === 'missed') {
    for (const key of ['complainant_statement', 'respondent_statement', 'discussion', 'evidence', 'agreements', 'unresolved']) payload[key] = 'Hindi naitala sa session na minarkahang hindi natuloy. Tingnan ang attendance at opisyal na tala.'
    payload.outcome = 'pending'
  }
  return payload
}
