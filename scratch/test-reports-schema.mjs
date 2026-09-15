import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function test() {
  // Try inserting a dummy row with minimal required fields and rollback/delete
  const testId = '00000000-0000-0000-0000-000000000001'
  const { data, error } = await supabase.from('reports').insert([{
    id: testId,
    category: 'Test',
    status: 'Pending',
  }]).select()
  console.log('reports test insert:', { data, error })
  if (data && data[0]) {
    console.log('reports columns:', Object.keys(data[0]))
    await supabase.from('reports').delete().eq('id', testId)
  }
}

test().catch(console.error)
