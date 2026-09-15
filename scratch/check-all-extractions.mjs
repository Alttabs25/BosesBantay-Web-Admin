import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const { data: exts } = await supabase.from('ai_extractions').select('*')
  console.log('Total ai_extractions:', exts.length)
  exts.forEach(e => {
    console.log({
      extraction_id: e.extraction_id,
      incident_type: e.incident_type,
      incident_datetime: e.incident_datetime,
      incident_location: e.incident_location,
      complainant: e.complainant,
      what: e.json_output?.what,
      who: e.json_output?.who,
      created_at: e.created_at
    })
  })
}

main().catch(console.error)
