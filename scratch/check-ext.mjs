import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const { data: ext } = await supabase.from('ai_extractions').select('*').eq('extraction_id', 370).single()
  console.log('ai_extraction 370:', ext)
}

main().catch(console.error)
