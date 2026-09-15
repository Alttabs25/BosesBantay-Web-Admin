import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  console.log('--- Checking all pre_blotters ---')
  const { data: pbs } = await supabase.from('pre_blotters').select('*')
  for (const p of pbs) {
    const s = JSON.stringify(p)
    if (s.includes('380594') || s.includes('pedddd') || s.includes('Flooding')) {
      console.log('Found in pre_blotters:', p.blotter_id, p.reference_no, p.incident_type, p.status, p.latitude, p.longitude, p.map_status, p.submitted_at)
    }
  }

  console.log('--- Checking all ai_extractions ---')
  const { data: exts } = await supabase.from('ai_extractions').select('*')
  for (const e of exts) {
    const s = JSON.stringify(e)
    if (s.includes('380594') || s.includes('pedddd') || s.includes('Flooding')) {
      console.log('Found in ai_extractions:', e.extraction_id, e.incident_type, e.complainant, e.incident_datetime)
    }
  }

  console.log('--- Checking all audit_logs ---')
  const { data: logs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(20)
  for (const l of logs) {
    const s = JSON.stringify(l)
    if (s.includes('380594') || s.includes('pedddd') || s.includes('Flooding')) {
      console.log('Found in audit_logs:', l.action, l.created_at)
    }
  }
}

main().catch(console.error)
