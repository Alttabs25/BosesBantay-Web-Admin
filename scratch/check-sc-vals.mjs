import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const { data: b } = await supabase.from('pre_blotters').select('*').eq('reference_no', 'SC-380594').single()
  console.log('SC-380594 record keys and values:')
  for (const [k, v] of Object.entries(b)) {
    console.log(`  ${k}: ${JSON.stringify(v)}`)
  }

  const rawLat = b.latitude != null ? parseFloat(b.latitude) : null
  const rawLng = b.longitude != null ? parseFloat(b.longitude) : null
  const hasValidCoords = rawLat != null && rawLng != null && !isNaN(rawLat) && !isNaN(rawLng) && rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180

  const isMapped1 = b.is_mapped !== undefined && b.is_mapped !== null
    ? (Boolean(b.is_mapped) && hasValidCoords)
    : (hasValidCoords && (b.map_status === 'Approved' || b.map_status === undefined))

  console.log('\nhasValidCoords:', hasValidCoords)
  console.log('b.is_mapped:', b.is_mapped)
  console.log('b.map_status:', b.map_status)
  console.log('Computed isMapped:', isMapped1)
}

main().catch(console.error)
