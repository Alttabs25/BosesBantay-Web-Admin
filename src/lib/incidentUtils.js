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
  const d = new Date(dateISO)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function generateRef(existingRefs) {
  const year = new Date().getFullYear()
  let ref
  do {
    const suffix = Math.floor(1000 + Math.random() * 9000)
    ref = `REF-${year}-${suffix}`
  } while (existingRefs.includes(ref))
  return ref
}
