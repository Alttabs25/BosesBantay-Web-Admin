export const SIMPLE_STATUS = { Sinuri: 'Under Review', Inimbestigahan: 'Investigating', Nareselba: 'Resolved', Spam: 'Spam' }
export function hearingVenue(note = '') {
  return [...note.matchAll(/^Venue: ([^\r\n]+)$/gm)].at(-1)?.[1]?.trim() || ''
}
export function scopedNextActions(report, now = Date.now(), { ignoreDateConstraints = false } = {}) {
  if (report.status === 'Sinuri') return { actions: ['review'], hint: 'Suriin muna ang draft bago magtakda ng pagdinig.', scheduleLabel: 'Itakda ang pagdinig' }
  if (report.status !== 'Inimbestigahan') return { actions: [], hint: report.status === 'Nareselba' ? 'Naitala na ang huling resulta.' : 'Walang aktibong proseso para sa status na ito.' }
  if (report.hearingCompleted) return { actions: ['finalize', 'schedule'], hint: 'May naitalang pagdinig. Itala ang aktuwal na resulta o magtakda ng susunod na pagdinig.', scheduleLabel: 'Itakda ang susunod na pagdinig', noteLabel: 'Dagdagan ang tala ng huling pagdinig' }
  if (!report.hearingDate || !Number.isFinite(Date.parse(report.hearingDate))) return { actions: ['schedule'], hint: 'Wala pang iskedyul. Itakda muna ang unang pagdinig.', scheduleLabel: 'Itakda ang unang pagdinig' }
  if (ignoreDateConstraints) return { actions: ['note', 'schedule'], hint: '', scheduleLabel: 'Baguhin ang iskedyul', noteLabel: 'Itala ang nangyari sa pagdinig' }
  if (Date.parse(report.hearingDate) > now) return { actions: ['schedule'], hint: 'Nakahanda na ang iskedyul. Hintayin ang pagdinig bago magtala ng resulta; maaaring baguhin ang iskedyul kung kinakailangan.', scheduleLabel: 'Baguhin ang iskedyul' }
  return { actions: ['note', 'schedule'], hint: 'Lumipas na ang nakatakdang oras. Itala kung naganap, ipinagpaliban o hindi natuloy; hindi awtomatikong itinuturing na naganap ang pagdinig.', scheduleLabel: 'Muling itakda ang pagdinig', noteLabel: 'Itala ang nangyari sa pagdinig' }
}
export function validateScopedAction(action, draft, report, now = Date.now(), { ignoreDateConstraints = false } = {}) {
  const errors = []
  if (!scopedNextActions(report, now, { ignoreDateConstraints }).actions.includes(action)) errors.push('Hindi pa naaangkop ang aksyong ito. Sundin ang kasalukuyang susunod na hakbang.')
  if (action === 'review' && report.status !== 'Sinuri') errors.push('Ang draft na Under Review lamang ang maaaring kumpirmahin.')
  if (['schedule', 'note', 'finalize'].includes(action) && report.status !== 'Inimbestigahan') errors.push('Kailangang Investigating ang report bago gawin ito.')
  if (action === 'schedule') {
    if (!draft.venue?.trim()) errors.push('Ilagay ang venue ng pagdinig.')
    if (/[\r\n]/.test(draft.venue || '') || (draft.venue || '').length > 250) errors.push('Gumamit ng isang linya para sa venue, hanggang 250 characters.')
    if (!Number.isFinite(Date.parse(draft.date)) || (!ignoreDateConstraints && Date.parse(draft.date) <= now)) errors.push(ignoreDateConstraints ? 'Pumili ng kumpletong petsa at oras.' : 'Pumili ng petsa at oras sa hinaharap.')
    if (!draft.note?.trim()) errors.push('Maglagay ng layunin o dahilan ng pagbabago ng iskedyul.')
  }
  if (action === 'note' && !draft.note?.trim()) errors.push('Maglagay ng maikling tala tungkol sa pagdinig o follow-up.')
  if (['note', 'past_note'].includes(action)) {
    if (!draft.note?.trim()) errors.push('Maglagay ng maikling session note.')
    if (!['held', 'postponed', 'missed'].includes(draft.sessionResult)) errors.push('Piliin kung naganap, ipinagpaliban o hindi natuloy ang pagdinig.')
  }
  if (action === 'past_note' && (!Number.isFinite(Date.parse(draft.date)) || Date.parse(draft.date) > now)) errors.push('Ilagay ang tunay na nakaraang petsa at oras ng pagdinig.')
  if (action === 'finalize') {
    if (!['settlement', 'cfa'].includes(draft.outcome)) errors.push('Piliin kung Nagkaareglo o may naisyung CFA.')
    if (!draft.note?.trim()) errors.push('Ilagay ang maikling detalye ng huling resulta.')
    if (!draft.confirmed) errors.push('Kumpirmahing aktuwal at nabeberipika ang resultang itinatala.')
  }
  return errors
}
export function scopedPatch(action, draft, report, actor, now = new Date()) {
  if (action === 'review') return { status: 'Inimbestigahan' }
  const note = [report.hearingNote, `${now.toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })} · ${actor}\n${draft.note.trim()}`].filter(Boolean).join('\n\n')
  if (action === 'schedule') return { hearingDate: new Date(draft.date).toISOString(), hearingNote: `${note}\nVenue: ${(draft.venue || '').trim()}`, hearingCompleted: false }
  if (['note', 'past_note'].includes(action)) return { hearingNote: `${note}\nKalagayan: ${{ held: 'Naganap', postponed: 'Ipinagpaliban', missed: 'Hindi natuloy' }[draft.sessionResult]}`, hearingCompleted: draft.sessionResult === 'held', ...(action === 'past_note' ? { hearingDate: new Date(draft.date).toISOString() } : {}) }
  if (action === 'finalize') return { status: 'Nareselba', hearingNote: note, outcome: `${draft.outcome === 'settlement' ? 'Settlement — Nagkaareglo' : 'Certificate to File Action (CFA) — naisyung sertipikasyon'}\n${draft.note.trim()}`, hearingCompleted: true }
  throw new Error('Hindi suportadong aksyon.')
}
