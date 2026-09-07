import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://biaqsosjorxklbtptdqy.supabase.co'
const supabaseAnonKey = 'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function check() {
  const { data, error } = await supabase.from('documents').select('*')
  if (error) {
    console.error('Error:', error)
    return
  }
  console.log('DOCUMENTS IN DB:', JSON.stringify(data.map(d => ({
    id: d.document_id,
    title: d.title,
    approval_status: d.approval_status,
    summary: d.summary,
    sections: d.sections
  })), null, 2))
}

check()
