import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function testColumn() {
  const { data, error } = await supabase.from('pre_blotters').select('is_mapped, mapped_at, mapped_by').limit(1)
  console.log('Select is_mapped:', data, error)
}

testColumn()
