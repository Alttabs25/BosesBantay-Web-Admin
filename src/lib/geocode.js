const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`,
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.display_name ?? null
  } catch {
    return null
  }
}

export async function searchAddress(query) {
  if (!query.trim()) return []
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=5&countrycodes=ph`,
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.map((item) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }))
  } catch {
    return []
  }
}
