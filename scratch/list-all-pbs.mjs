import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const { data: pbs } = await supabase.from('pre_blotters').select('blotter_id, reference_no, status, latitude, longitude, map_status, incident_type, user_id, submitted_at')
  console.log('ALL pre_blotters:', pbs)
}

main().catch(console.error)
