import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function test() {
  const { data, error } = await supabase.from('pre_blotters').select('*').limit(1)
  console.log('pre_blotters error:', error)
  if (data && data[0]) {
    console.log('Columns in pre_blotters:', Object.keys(data[0]))
  }

  const { data: rData, error: rError } = await supabase.from('reports').select('*').limit(1)
  console.log('reports error:', rError)
  if (rData && rData[0]) {
    console.log('Columns in reports:', Object.keys(rData[0]))
  } else {
    console.log('reports is empty, testing insert or select specific cols')
  }
}

test().catch(console.error)
