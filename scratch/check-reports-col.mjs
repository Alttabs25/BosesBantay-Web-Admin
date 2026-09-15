import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function checkReports() {
  const { data, error } = await supabase.from('reports').select('*').limit(1)
  console.log('Reports sample:', data, error)
  // Check column names by selecting a non-existent column to see error or column list
  const { error: colErr } = await supabase.from('reports').select('non_existent_column')
  console.log('Col check error message:', colErr?.message)
}

checkReports()
