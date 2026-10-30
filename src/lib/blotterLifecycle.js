export const STAGES = { review: 'Pagsusuri', documentation: 'Incident documentation', mediation: 'Mediation', conciliation: 'Pangkat conciliation', arbitration: 'Arbitration', settlement: 'Kasunduan / monitoring', referral: 'Referral', closed: 'Isinara', archived: 'Archived' }
export const EVENT_LABELS = { assessment: 'Jurisdiction at intake review', assignment: 'Case handler assigned', meeting_scheduled: 'Pagdinig itinakda', meeting_rescheduled: 'Iskedyul binago', meeting_recorded: 'Minutes / session record', meeting_verified: 'Minutes verified', notice_issued: 'Summons / notice issued', notice_served: 'Service of notice recorded', pangkat: 'Pangkat constituted', arbitration: 'Written arbitration agreement', settlement: 'Signed settlement recorded', repudiation: 'Repudiation recorded', referral: 'Referral recorded', document: 'Document registered', correction: 'Correction / addendum', compliance: 'Compliance / follow-up', disposition: 'Disposition approved', archive: 'Archived' }
export const LEGAL_URL = 'https://www.lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html'
export const DEFAULT_CASE_RULES = { mediationDays: 15, pangkatConveneDays: 3, conciliationDays: 15, settlementRepudiationDays: 10, arbitrationRepudiationDays: 5 }
export const formatCaseDate = (value) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('fil-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Hindi nakatala'
export function projectCase(events = []) {
  const state = { stage: 'review', assessment: null, assignment: null, meetings: [], documents: [], disposition: null, settlement: null, arbitration: null, notices: [], events }
  const meetings = new Map()
  for (const event of events) {
    const d = event.payload || {}
    if (event.kind === 'assessment') { state.assessment = d; state.stage = d.route === 'kp' ? 'mediation' : d.route === 'documentation' ? 'documentation' : 'referral' }
    if (event.kind === 'assignment') state.assignment = d
    if (event.kind === 'meeting_scheduled') meetings.set(d.meeting_id, { ...d, number: meetings.size + 1, status: 'scheduled', revisions: [], recordedBy: event.actor_name })
    if (event.kind === 'meeting_rescheduled' && meetings.has(d.meeting_id)) { const m = meetings.get(d.meeting_id); m.revisions.push({ ...m, revisions: undefined }); Object.assign(m, d) }
    if (event.kind === 'meeting_recorded' && meetings.has(d.meeting_id)) Object.assign(meetings.get(d.meeting_id), d, { recordedBy: event.actor_name, verified: false })
    if (event.kind === 'meeting_recorded' && d.minutes_reference) state.documents.push({ id: event.id, kind: event.kind, title: 'Meeting minutes', reference: d.minutes_reference, meeting_id: d.meeting_id, occurred_at: d.occurred_at, actor: event.actor_name })
    if (event.kind === 'meeting_verified' && meetings.has(d.meeting_id)) Object.assign(meetings.get(d.meeting_id), { verified: true, verifiedBy: event.actor_name, verifiedAt: event.created_at })
    if (event.kind === 'notice_issued') state.notices.push({ ...d, id: event.id, served: false })
    if (event.kind === 'notice_served') { const notice = state.notices.find((n) => n.id === d.notice_id); if (notice) Object.assign(notice, { served: true, service: d }) }
    if (event.kind === 'pangkat') state.stage = 'conciliation'
    if (event.kind === 'arbitration') { state.stage = 'arbitration'; state.arbitration = d }
    if (event.kind === 'settlement') { state.stage = 'settlement'; state.settlement = d }
    if (event.kind === 'repudiation') { state.stage = 'review'; state.disposition = null }
    if (event.kind === 'referral') state.stage = 'referral'
    if (['document', 'notice_issued', 'settlement', 'arbitration', 'referral'].includes(event.kind)) state.documents.push({ ...d, kind: event.kind, id: event.id, actor: event.actor_name })
    if (event.kind === 'disposition') { state.disposition = d; state.stage = 'closed' }
    if (event.kind === 'archive') state.stage = 'archived'
  }
  state.meetings = [...meetings.values()]
  return state
}
export function nextCaseAction(state) {
  if (!state.assessment) return ['assessment', 'Suriin muna ang hurisdiksyon at tamang ruta.']
  if (state.stage === 'archived') return [null, 'Archived. Available ang buong history para sa awtorisadong pagtingin.']
  if (state.stage === 'closed') return ['compliance', 'Subaybayan ang obligasyon o magtala ng post-disposition development.']
  if (state.stage === 'referral') return ['referral', 'Itala ang receiving agency, dahilan, dokumento at follow-up.']
  if (state.stage === 'documentation') return ['disposition', 'Kumpirmahin kung documentation lamang o kailangan ng referral.']
  if (state.stage === 'settlement') return ['compliance', 'Subaybayan ang kasunduan, repudiation at mga obligasyon bago disposition.']
  const scheduled = state.meetings.find((m) => m.status === 'scheduled')
  if (scheduled) return ['meeting_recorded', `Itala ang attendance at nangyari sa Meeting ${scheduled.number}.`]
  const last = state.meetings.at(-1)
  if (last && !last.verified && last.status === 'completed') return ['meeting_verified', 'Ipa-verify ang minutes bago ang susunod na legal na hakbang.']
  if (last?.outcome === 'unsuccessful' && state.stage === 'mediation') return ['pangkat', 'Ipa-review ang mediation outcome at naaangkop na Pangkat process.']
  return ['meeting_scheduled', 'Itakda ang susunod na pagpupulong at ihanda ang summons / notice.']
}

export function availableCaseActions(state) {
  if (state.stage === 'archived') return []
  const common = ['assignment', 'document', ...(state.events.length ? ['correction'] : [])]
  if (state.stage === 'closed') return ['compliance', ...(state.settlement || state.arbitration ? ['repudiation'] : []), 'document', 'correction', 'archive']
  if (!state.assessment) return ['assessment', 'referral', ...common]
  if (state.stage === 'review') return ['assessment', 'referral', ...common]
  if (state.stage === 'documentation') return ['assessment', 'referral', 'disposition', ...common]
  if (state.stage === 'referral') return ['referral', 'compliance', 'disposition', 'assessment', ...common]
  if (state.stage === 'settlement') return ['compliance', 'repudiation', 'disposition', ...common]
  const active = state.meetings.some((m) => m.status === 'scheduled')
  return [...(active ? ['meeting_recorded', 'meeting_rescheduled'] : ['meeting_scheduled']), 'notice_issued', ...(state.notices.some((n) => !n.served) ? ['notice_served'] : []), ...(state.meetings.some((m) => m.status !== 'scheduled' && !m.verified) ? ['meeting_verified'] : []), ...(state.stage === 'mediation' ? ['pangkat'] : []), ...(['mediation', 'conciliation'].includes(state.stage) ? ['arbitration'] : []), 'settlement', 'referral', 'disposition', 'compliance', ...common]
}

// Advisory date reminders only: never automatically decide eligibility or close a case.
export function caseDeadlines(state, now = Date.now(), rules = DEFAULT_CASE_RULES) {
  const result = []
  const add = (label, trigger, days, basis) => { if (!Number.isFinite(Date.parse(trigger))) return; const due = new Date(Date.parse(trigger) + days * 86400000); result.push({ label, due: due.toISOString(), overdue: due.getTime() < now, basis }) }
  const first = state.meetings.find((m) => m.type === 'mediation' && m.status === 'completed')
  if (state.stage === 'mediation') add('Mediation period: ipa-review ang susunod na hakbang', first?.actual_at, rules.mediationDays, 'RA 7160 §410(b)')
  const pangkat = state.events.find((e) => e.kind === 'pangkat')
  if (state.stage === 'conciliation') { add('Pangkat convening: suriin ang iskedyul', pangkat?.payload.occurred_at, rules.pangkatConveneDays, 'RA 7160 §410(d)'); const firstConciliation = state.meetings.find((m) => m.type === 'conciliation' && m.status === 'completed'); add('Conciliation period: suriin ang resulta / extension', firstConciliation?.actual_at, rules.conciliationDays, 'RA 7160 §410(e)') }
  if (state.settlement) add('Settlement repudiation period: ipa-review', state.settlement.occurred_at, rules.settlementRepudiationDays, 'RA 7160 §§416, 418')
  if (state.arbitration) add('Arbitration agreement repudiation period: ipa-review', state.arbitration.occurred_at, rules.arbitrationRepudiationDays, 'RA 7160 §413')
  return result
}

export function validateCaseEvent(kind, d, state, now = Date.now()) {
  const errors = []
  const need = (key, label) => { if (!String(d[key] || '').trim()) errors.push(`${label}: kailangan.`) }
  if (!EVENT_LABELS[kind]) errors.push('Hindi suportadong aksyon.')
  need('notes', 'Tala / batayan')
  if (state.stage === 'archived') errors.push('Archived ang kaso; walang bagong aksyon.')
  if (['closed'].includes(state.stage) && !['compliance', 'correction', 'document', 'repudiation', 'archive'].includes(kind)) errors.push('Isinara na ang kaso. Magtala ng follow-up o dokumentadong development.')
  if (!state.assessment && !['assessment', 'assignment', 'document', 'correction', 'referral'].includes(kind)) errors.push('Kailangan muna ng jurisdiction assessment.')
  if (kind !== 'meeting_scheduled' && (!Number.isFinite(Date.parse(d.occurred_at)) || Date.parse(d.occurred_at) > now)) errors.push('Kailangan ang aktuwal na petsa na hindi nasa hinaharap.')
  if (kind === 'assessment') { if (!['kp', 'documentation', 'urgent', 'outside'].includes(d.route)) errors.push('Piliin ang tamang ruta.'); need('jurisdiction_basis', 'Hurisdiksyon / eligibility assessment'); need('venue_basis', 'Venue assessment'); if (!d.approved) errors.push('Kailangan ng tahasang officer review.') }
  if (kind === 'assignment') need('assigned_to', 'Case handler')
  if (['meeting_scheduled', 'meeting_rescheduled'].includes(kind)) {
    need('meeting_id', 'Meeting ID'); need('venue', 'Lugar'); need('presiding', 'Presiding official'); need('agenda', 'Agenda')
    if (!['mediation', 'conciliation', 'arbitration'].includes(d.type)) errors.push('Piliin ang procedural type.')
    if (d.type === 'conciliation' && state.stage !== 'conciliation') errors.push('Itala muna ang Pangkat constitution.')
    if (d.type === 'arbitration' && state.stage !== 'arbitration') errors.push('Itala muna ang written arbitration agreement.')
    if (d.type === 'mediation' && state.stage !== 'mediation') errors.push('Hindi mediation ang kasalukuyang ruta.')
    if (!Number.isFinite(Date.parse(d.scheduled_at)) || Date.parse(d.scheduled_at) <= now) errors.push('Ang iskedyul ay dapat nasa hinaharap.')
    if (!Number.isFinite(Date.parse(d.ends_at)) || Date.parse(d.ends_at) <= Date.parse(d.scheduled_at)) errors.push('Dapat mas huli ang pagtatapos sa simula.')
    if (state.meetings.some((m) => m.status === 'scheduled' && m.meeting_id !== d.meeting_id)) errors.push('May aktibong iskedyul. I-record o i-reschedule muna iyon.')
    if (kind === 'meeting_rescheduled' && !state.meetings.some((m) => m.meeting_id === d.meeting_id && m.status === 'scheduled')) errors.push('Hindi aktibong pagdinig ang nire-reschedule.')
  }
  if (kind === 'meeting_recorded') {
    const meeting = state.meetings.find((m) => m.meeting_id === d.meeting_id)
    if (!meeting || meeting.status !== 'scheduled') errors.push('Pumili ng aktibong scheduled meeting.')
    if (!['completed', 'postponed', 'missed'].includes(d.status)) errors.push('Piliin ang meeting status.')
    if (!Number.isFinite(Date.parse(d.actual_at)) || Date.parse(d.actual_at) > now) errors.push('Kailangan ang aktuwal na oras ng session.')
    for (const key of ['attendance', 'actual_venue', 'attendees', 'absence_reasons', 'complainant_statement', 'respondent_statement', 'discussion', 'evidence', 'agreements', 'unresolved', 'official_actions', 'responsibilities', 'next_steps', 'minutes_reference']) need(key, key.replaceAll('_', ' '))
    if (!Number.isFinite(Date.parse(d.actual_end)) || Date.parse(d.actual_end) < Date.parse(d.actual_at) || Date.parse(d.actual_end) > now) errors.push('Kailangan ang valid actual end time na hindi nasa hinaharap.')
    if (d.status === 'completed' && d.attendance !== 'both') errors.push('I-record bilang missed / postponed kung hindi parehong dumalo.')
    if (!['pending', 'agreement_proposed', 'unsuccessful', 'continued'].includes(d.outcome)) errors.push('Piliin ang session outcome.')
  }
  if (kind === 'meeting_verified' && !state.meetings.some((m) => m.meeting_id === d.meeting_id && m.status !== 'scheduled' && !m.verified)) errors.push('Walang unverified meeting record na tumutugma.')
  if (['notice_issued', 'pangkat', 'arbitration', 'settlement', 'referral', 'document', 'disposition'].includes(kind)) need('reference', 'Document / official record reference')
  if (kind === 'notice_served' && !state.notices.some((n) => n.id === d.notice_id && !n.served)) errors.push('Pumili ng issued notice na wala pang service record.')
  if (kind === 'notice_served') { need('recipient', 'Recipient'); need('method', 'Paraan ng service'); need('proof', 'Patunay / service record') }
  if (kind === 'pangkat') { if (state.stage !== 'mediation') errors.push('Mula lamang sa mediation ang Pangkat transition.'); need('members', 'Pangkat members at chairman'); if (!d.approved) errors.push('Kailangan ang authorized approval at batayan.') }
  if (['arbitration', 'settlement', 'referral', 'disposition', 'archive'].includes(kind) && !d.approved) errors.push('Kailangan ang tahasang authorized review.')
  if (kind === 'arbitration' && !['mediation', 'conciliation'].includes(state.stage)) errors.push('Hindi available ang arbitration agreement sa kasalukuyang yugto.')
  if (kind === 'arbitration') need('terms', 'Written voluntary agreement at signatories')
  if (kind === 'document') { need('title', 'Document title'); need('document_type', 'Document type') }
  if (kind === 'notice_issued') need('recipient', 'Notice recipient')
  if (kind === 'settlement') { if (!['mediation', 'conciliation', 'arbitration'].includes(state.stage)) errors.push('Hindi naaangkop ang settlement sa kasalukuyang ruta.'); need('terms', 'Settlement terms'); need('signatures', 'Signatures at attestation') }
  if (kind === 'referral') { need('agency', 'Receiving agency'); need('follow_up', 'Referral follow-up') }
  if (kind === 'correction') { if (!state.events.some((e) => e.id === d.corrects_event_id)) errors.push('Piliin ang orihinal na event.'); need('replacement', 'Corrected details') }
  if (kind === 'repudiation') { if (!state.settlement && !state.arbitration) errors.push('Walang naitalang settlement / arbitration agreement.'); need('reference', 'Sworn statement / document reference') }
  if (kind === 'archive' && state.stage !== 'closed') errors.push('I-dispose muna ang kaso bago i-archive.')
  if (kind === 'disposition') {
    if (!['settled', 'cfa', 'referred', 'documentation', 'arbitration_award'].includes(d.disposition)) errors.push('Piliin ang disposition.')
    if (d.disposition === 'settled' && state.stage !== 'settlement') errors.push('Kailangan muna ng signed settlement at monitoring review.')
    if (d.disposition === 'referred' && state.stage !== 'referral') errors.push('Kailangan muna ng referral record.')
    if (d.disposition === 'documentation' && state.stage !== 'documentation') errors.push('Documentation route lamang ito.')
    if (d.disposition === 'arbitration_award' && state.stage !== 'arbitration') errors.push('Kailangan muna ng written arbitration agreement.')
    if (d.disposition === 'cfa') need('legal_basis', 'CFA basis at officer verification; hindi automatic mula sa absence')
  }
  return [...new Set(errors)]
}
