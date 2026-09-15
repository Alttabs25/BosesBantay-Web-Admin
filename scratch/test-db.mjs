import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const { data: pb, error: pbErr } = await supabase.from('pre_blotters').select('*').limit(2)
  console.log('pre_blotters:', pb, pbErr)
  const { data: rep, error: repErr } = await supabase.from('reports').select('*').limit(2)
  console.log('reports:', rep, repErr)
}

main()
