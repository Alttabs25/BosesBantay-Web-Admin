import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  console.log('Searching all pre_blotters...')
  const { data: pbs } = await supabase.from('pre_blotters').select('*, ai_extractions(*)')
  console.log('pre_blotters count:', pbs.length)
  pbs.forEach(p => {
    console.log({
      blotter_id: p.blotter_id,
      reference_no: p.reference_no,
      status: p.status,
      lat: p.latitude,
      lng: p.longitude,
      map_status: p.map_status,
      complainant: p.ai_extractions?.complainant,
      details_complainant: p.complainant_details,
      submitted_at: p.submitted_at
    })
  })
}

main().catch(console.error)
