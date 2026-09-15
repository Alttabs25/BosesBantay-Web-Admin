import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const tableNames = ['pre_blotters', 'reports', 'ai_extractions', 'audit_logs', 'documents', 'users', 'barangay_sectors', 'emergency_contacts', 'roles']
  for (const t of tableNames) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`Table ${t}: count = ${count}, error = ${error?.message || null}`)
  }
}

main().catch(console.error)
