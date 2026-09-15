import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  console.log('Searching for SC-380594 in pre_blotters...')
  const { data: pbs } = await supabase.from('pre_blotters').select('*').eq('reference_no', 'SC-380594')
  console.log('pbs found:', pbs)

  console.log('Searching for SC-380594 in reports...')
  const { data: reps } = await supabase.from('reports').select('*')
  console.log('Total reports:', reps?.length)
  console.log('reports:', reps)
}

main().catch(console.error)
