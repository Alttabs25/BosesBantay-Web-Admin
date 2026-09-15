export function formatDisplayDateTime(dateISO) {
  const d = new Date(dateISO)
  const datePart = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${datePart} ${hours}:${minutes}${ampm}`
}

export function toDatetimeLocalValue(dateISO) {
  if (!dateISO) return ''
  const d = new Date(dateISO)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function generateRef(existingRefs = []) {
  const year = new Date().getFullYear()
  let ref
  do {
    const suffix = Math.floor(1000 + Math.random() * 9000)
    ref = `REF-${year}-${suffix}`
  } while (existingRefs.includes(ref))
  return ref
}

export function formatDisplayDate(dateISO) {
  if (!dateISO) return 'N/A'
  const d = new Date(dateISO)
  if (isNaN(d.getTime())) return 'N/A'
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDisplayTime(dateISO) {
  if (!dateISO) return 'N/A'
  const d = new Date(dateISO)
  if (isNaN(d.getTime())) return 'N/A'
  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

export function isUnderReview(status) {
  if (!status) return false
  const s = String(status).trim().toLowerCase()
  return s === 'sinuri' || s === 'under review' || s === 'pending'
}

export function isVerifiedReport(status) {
  if (!status) return false
  const s = String(status).trim().toLowerCase()
  if (s === 'sinuri' || s === 'under review' || s === 'pending' || s === 'spam') return false
  return true
}

export function getStatusLabel(status) {
  if (!status) return 'Under Review'
  const s = String(status).trim().toLowerCase()
  if (s === 'sinuri' || s === 'under review' || s === 'pending') return 'Under Review'
  if (s === 'inimbestigahan' || s === 'investigating' || s === 'iniimbestigahan') return 'Investigating'
  if (s === 'nareselba' || s === 'resolved' || s === 'nalutas') return 'Resolved'
  if (s === 'spam') return 'Spam'
  return status
}

