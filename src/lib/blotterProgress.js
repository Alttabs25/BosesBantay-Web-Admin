// One display model for list cards, record details and staff workflow.
// Existing database status values remain unchanged.
export function blotterProgress(report) {
  const raw = String(report.status || '').trim().toLowerCase()
  const status = ['sinuri','under review','pending'].includes(raw) ? 'review' : ['inimbestigahan','investigating','in progress'].includes(raw) ? 'active' : ['nareselba','resolved','closed','completed'].includes(raw) ? 'closed' : raw === 'spam' ? 'spam' : 'unknown'
  const outcomeText = String(report.outcome || '').trim().split(/\r?\n/)[0]
  const outcome = status !== 'closed' ? null : /certificate to file action|\bcfa\b/i.test(outcomeText) ? 'CFA recorded' : /settlement|settled|nagkaareglo|kasunduan/i.test(outcomeText) ? 'Settled' : 'Not recorded'
  const note = String(report.hearingNote || '')
  const lastResult = [...note.matchAll(/^Kalagayan:\s*(Naganap|Ipinagpaliban|Hindi natuloy)\s*$/gm)].at(-1)
  const freshSchedule = note.lastIndexOf('\nVenue:') > (lastResult?.index ?? -1)
  let stage = 'Not recorded', next = 'Review the record', key = 'unknown'
  if (status === 'review') { stage = 'Awaiting review'; next = 'Review and confirm receipt'; key = 'review' }
  else if (status === 'closed') { stage = 'Completed'; next = 'View final outcome'; key = 'closed' }
  else if (status === 'spam') { stage = 'Flagged as spam'; next = 'View recorded reason'; key = 'spam' }
  else if (status === 'active') {
    if (report.hearingCompleted === true) { stage = 'Hearing completed'; next = 'Record final outcome or schedule another hearing'; key = 'outcome_pending' }
    else if (!freshSchedule && lastResult?.[1] === 'Ipinagpaliban') { stage = 'Hearing postponed'; next = 'Reschedule hearing'; key = 'postponed' }
    else if (!freshSchedule && lastResult?.[1] === 'Hindi natuloy') { stage = 'Hearing did not proceed'; next = 'Reschedule hearing'; key = 'missed' }
    else if (report.hearingDate && Number.isFinite(Date.parse(report.hearingDate))) { stage = 'Hearing scheduled'; next = 'Record hearing result or change schedule'; key = 'scheduled' }
    else { stage = 'Awaiting hearing schedule'; next = 'Schedule the first hearing'; key = 'schedule_pending' }
  }
  return { status, statusLabel: { review: 'Under review', active: 'In progress', closed: 'Closed', spam: 'Spam', unknown: 'Not recorded' }[status], stage, stageKey: key, outcome, next }
}
