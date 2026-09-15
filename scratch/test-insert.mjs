import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function test() {
  const refNo = `SC-${Math.floor(100000 + Math.random() * 900000)}`
  console.log('Testing insert with refNo:', refNo)

  const { data: ext, error: extErr } = await supabase
    .from('ai_extractions')
    .insert([{
      incident_type: 'Flooding / Drainage',
      incident_datetime: new Date().toISOString(),
      incident_location: 'Quezon City',
      complainant: 'Test Complainant',
      respondent: 'Hindi Alam',
      narrative_summary: 'Test flooding narrative',
      json_output: {
        what: 'Flooding / Drainage',
        who: 'Hindi Alam',
        where: 'Quezon City',
        when: new Date().toISOString(),
        why: 'Drainage blockage',
        how: 'Heavy rain causing flood',
        classification: 'Flooding / Drainage',
        severity: 'Katamtaman'
      }
    }])
    .select()

  console.log('ext result:', { ext, extErr })

  const pbInsert = {
    reference_no: refNo,
    extraction_id: ext[0].extraction_id,
    sector_id: null,
    latitude: null,
    longitude: null,
    status: 'Inimbestigahan',
    remarks: '',
    map_status: 'Pending',
    is_mapped: false,
    map_reviewed_by: null,
    map_reviewed_at: null,
    mapped_by: null,
    mapped_at: null,
  }

  const { data: pbData, error: pbErr } = await supabase
    .from('pre_blotters')
    .insert([pbInsert])
    .select()

  console.log('pbInsert 1 result:', { pbData, pbErr })

  if (pbErr && pbErr.message?.includes('is_mapped')) {
    const fallbackInsert = { ...pbInsert }
    delete fallbackInsert.is_mapped
    delete fallbackInsert.mapped_by
    delete fallbackInsert.mapped_at
    const { data: fbData, error: fbErr } = await supabase.from('pre_blotters').insert([fallbackInsert]).select()
    console.log('fallback insert result:', { fbData, fbErr })
  }
}

test().catch(console.error)
