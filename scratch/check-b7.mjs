import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const { data: b7 } = await supabase.from('pre_blotters').select('*, ai_extractions(*)').eq('blotter_id', 7).single()
  console.log('blotter_id 7:', b7)
}

main().catch(console.error)
