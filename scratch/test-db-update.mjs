import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function test() {
  console.log('Testing fallback update on pre_blotters blotter_id: 7 (SC-581001)...')
  
  const fbUpdate = {
    latitude: 14.6750,
    longitude: 121.0450,
    map_status: 'Approved',
    map_reviewed_by: null,
    map_reviewed_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('pre_blotters').update(fbUpdate).eq('blotter_id', 7).select()
  console.log('Fallback update result:', { data, error })
}

test().catch(console.error)
