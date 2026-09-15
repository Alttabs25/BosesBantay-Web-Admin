import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  console.log('Searching for SC-380594...')
  const { data: pbs } = await supabase.from('pre_blotters').select('*')
  console.log('pre_blotters total:', pbs?.length)
  const pbFound = pbs?.find(p => p.reference_no?.includes('380594') || String(p.blotter_id)?.includes('380594'))
  console.log('pbFound:', pbFound)

  const { data: reps } = await supabase.from('reports').select('*')
  console.log('reports total:', reps?.length)
  const repFound = reps?.find(r => r.reference_no?.includes('380594') || String(r.id)?.includes('380594'))
  console.log('repFound:', repFound)

  if (!pbFound && !repFound) {
    console.log('Sample pre_blotters reference_no:', pbs?.map(p => ({ blotter_id: p.blotter_id, reference_no: p.reference_no, status: p.status, is_mapped: p.is_mapped, lat: p.latitude, lng: p.longitude })))
    console.log('Sample reports:', reps?.map(r => ({ id: r.id, reference_no: r.reference_no, status: r.status, is_mapped: r.is_mapped, lat: r.latitude, lng: r.longitude })))
  }
}

main().catch(console.error)
