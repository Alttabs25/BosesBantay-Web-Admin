import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

function calculateAge(birthdate) {
  if (!birthdate) return null
  const diff = Date.now() - new Date(birthdate).getTime()
  return Math.abs(new Date(diff).getUTCFullYear() - 1970)
}

function formatDateTimeLocal(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function simulateFetchData() {
  const { data: usersData } = await supabase
    .from('users')
    .select('*, roles(role_name)')

  const { data: pbsData } = await supabase
    .from('pre_blotters')
    .select('*, ai_extractions(*), barangay_sectors(*)')

  let mappedBlotter = []
  let mappedIncidents = []

  if (pbsData) {
    pbsData.forEach(b => {
      const json = b.ai_extractions?.json_output || {}
      const complainantName = json.complainant || b.ai_extractions?.complainant || 'Residente'
      
      const userObj = usersData?.find(u => u.id === b.user_id) ||
                      usersData?.find(u => `${u.first_name} ${u.last_name}`.trim().toLowerCase() === complainantName.toLowerCase())

      const rawLat = b.latitude != null ? parseFloat(b.latitude) : null
      const rawLng = b.longitude != null ? parseFloat(b.longitude) : null
      const hasValidCoords = rawLat != null && rawLng != null && !isNaN(rawLat) && !isNaN(rawLng) && rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180

      const isMapped = b.is_mapped !== undefined && b.is_mapped !== null
        ? (Boolean(b.is_mapped) && hasValidCoords)
        : (hasValidCoords && (b.map_status === 'Approved' || b.map_status === undefined))

      const lat = hasValidCoords ? rawLat : null
      const lng = hasValidCoords ? rawLng : null

      const incidentItem = {
        id: b.reference_no,
        ref: b.reference_no,
        blotterId: b.blotter_id,
        title: json.what || b.ai_extractions?.incident_type || 'Kaso',
        classification: json.classification || b.ai_extractions?.incident_type || 'Kaso',
        severity: json.severity || 'Katamtaman',
        excerpt: b.ai_extractions?.narrative_summary || b.remarks || '',
        location: b.location_address || b.ai_extractions?.incident_location || 'Quezon City',
        address: b.location_address || b.ai_extractions?.incident_location || 'Quezon City',
        dateISO: b.ai_extractions?.incident_datetime || b.submitted_at,
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        sector: b.barangay_sectors?.sector_name || 'Sector 1',
        mapStatus: isMapped ? 'Approved' : (b.map_status || 'Pending'),
        is_mapped: isMapped,
        isMapped,
        mapReviewedBy: b.map_reviewed_by || b.mapped_by || null,
        mapReviewedAt: b.map_reviewed_at || b.mapped_at || null,
        filedBy: complainantName,
        status: b.status || 'Sinuri',
      }

      mappedIncidents.push(incidentItem)

      mappedBlotter.push({
        id: b.reference_no,
        ref: b.reference_no,
        blotterId: b.blotter_id,
        rawDate: b.submitted_at || b.created_at,
        title: b.incident_type || b.ai_extractions?.incident_type || 'Kaganapan',
        status: b.status || 'Sinuri',
        datetime: new Date(b.submitted_at || Date.now()).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).toUpperCase(),
        filedBy: complainantName,
        what: json.what || b.incident_type || b.ai_extractions?.incident_type || 'Kaganapan',
        who: json.who || b.ai_extractions?.respondent || 'Hindi Alam',
        where: json.where || b.location_address || b.ai_extractions?.incident_location || 'N/A',
        location: b.location_address || b.ai_extractions?.incident_location || 'N/A',
        address: b.location_address || b.ai_extractions?.incident_location || 'N/A',
        when: json.when || 'N/A',
        why: json.why || 'N/A',
        how: json.how || b.ai_extractions?.narrative_summary || 'N/A',
        severity: json.severity || 'Katamtaman',
        sector: b.barangay_sectors?.sector_name || 'Sector 1',
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        is_mapped: isMapped,
        isMapped,
        mapStatus: isMapped ? 'Approved' : (b.map_status || 'Pending'),
      })
    })
  }

  const { data: reportsData } = await supabase.from('reports').select('*')
  console.log('mappedBlotter count:', mappedBlotter.length)
  mappedBlotter.forEach(b => {
    console.log(`id: ${b.id} | title: ${b.title} | status: ${b.status} | is_mapped: ${b.is_mapped} | isMapped: ${b.isMapped} | lat: ${b.lat} | mapStatus: ${b.mapStatus} | filedBy: ${b.filedBy} | datetime: ${b.datetime}`)
  })
}

simulateFetchData().catch(console.error)
