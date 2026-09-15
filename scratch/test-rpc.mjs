import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function test() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' })
  console.log('rpc exec_sql:', { data, error })
}

test().catch(console.error)
