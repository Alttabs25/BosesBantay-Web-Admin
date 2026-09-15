import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function test() {
  const refOrId = 'SC-865546'
  const lat = 14.6765
  const lng = 121.0435
  const location = 'Barangay Milagrosa, Quezon City'

  console.log(`Mapping ${refOrId}...`)

  const { data: pb, error: pbFindErr } = await supabase
    .from('pre_blotters')
    .select('blotter_id, extraction_id')
    .eq('reference_no', refOrId)
    .maybeSingle()

  console.log('Lookup pb:', pb, 'error:', pbFindErr)

  if (pb) {
    const pbUpdate = {
      latitude: lat,
      longitude: lng,
      is_mapped: true,
      map_status: 'Approved',
      map_reviewed_by: null,
      map_reviewed_at: new Date().toISOString(),
      mapped_by: null,
      mapped_at: new Date().toISOString(),
    }
    const { error: pbErr } = await supabase.from('pre_blotters').update(pbUpdate).eq('blotter_id', pb.blotter_id)
    console.log('pbErr:', pbErr)
    if (pbErr && pbErr.message?.includes('is_mapped')) {
      const fbRes = await supabase.from('pre_blotters').update({
        latitude: lat,
        longitude: lng,
        map_status: 'Approved',
        map_reviewed_by: null,
        map_reviewed_at: new Date().toISOString(),
      }).eq('blotter_id', pb.blotter_id).select()
      console.log('fbRes:', fbRes)
    }

    if (pb.extraction_id && location) {
      await supabase.from('ai_extractions').update({ incident_location: location }).eq('extraction_id', pb.extraction_id)
    }
  }

  // Now verify what is in pre_blotters:
  const { data: verifyData } = await supabase.from('pre_blotters').select('*, ai_extractions(*)').eq('reference_no', refOrId).single()
  console.log('Verified in DB:', {
    blotter_id: verifyData.blotter_id,
    reference_no: verifyData.reference_no,
    latitude: verifyData.latitude,
    longitude: verifyData.longitude,
    map_status: verifyData.map_status,
    is_mapped: verifyData.is_mapped,
    location: verifyData.ai_extractions?.incident_location
  })
}

test().catch(console.error)
