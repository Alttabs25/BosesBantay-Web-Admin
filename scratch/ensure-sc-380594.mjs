import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function ensureSc380594() {
  const { data: existing } = await supabase
    .from('pre_blotters')
    .select('blotter_id, reference_no, status, latitude, longitude')
    .eq('reference_no', 'SC-380594')
    .maybeSingle()

  if (existing) {
    console.log('SC-380594 already exists:', existing)
    return
  }

  console.log('Inserting SC-380594 into ai_extractions and pre_blotters...')
  const { data: ext, error: extErr } = await supabase
    .from('ai_extractions')
    .insert([{
      incident_type: 'Flooding / Drainage',
      incident_datetime: '2026-09-12T14:30:00.000Z',
      incident_location: '123 Katipunan Ave., Barangay Milagrosa, Quezon City',
      complainant: 'Maria Santos',
      respondent: 'Hindi Alam',
      narrative_summary: 'Matinding baha at baradong kanal dulot ng basurang naipon sa drainage system matapos ang malakas na ulan.',
      json_output: {
        what: 'Flooding / Drainage',
        who: 'Hindi Alam',
        where: '123 Katipunan Ave., Barangay Milagrosa, Quezon City',
        when: '2026-09-12T14:30:00.000Z',
        why: 'Baradong drainage canal at tambak ng basura',
        how: 'Umapaw ang tubig-baha papunta sa mga kabahayan',
        classification: 'Flooding / Drainage',
        severity: 'Katamtaman',
        phone: '0917-123-4567',
        address: '123 Katipunan Ave., Barangay Milagrosa',
        gender: 'Babae',
        age: 38,
        is_minor: false
      }
    }])
    .select()

  if (extErr) {
    console.error('Error creating extraction:', extErr)
    return
  }

  const pbInsert = {
    reference_no: 'SC-380594',
    extraction_id: ext[0].extraction_id,
    sector_id: null,
    latitude: null,
    longitude: null,
    status: 'Inimbestigahan',
    remarks: 'Opisyal na blotter record na kasalukuyang iniimbestigahan ng barangay.',
    map_status: 'Pending',
    incident_type: 'Flooding / Drainage',
    location_address: '123 Katipunan Ave., Barangay Milagrosa, Quezon City',
  }

  const { data: pb, error: pbErr } = await supabase
    .from('pre_blotters')
    .insert([pbInsert])
    .select()

  if (pbErr) {
    console.error('Error creating pre_blotter SC-380594:', pbErr)
  } else {
    console.log('Successfully created SC-380594:', pb[0])
  }
}

ensureSc380594().catch(console.error)
