import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function testFullPersistence() {
  console.log('=== TEST 1: Retrieve SC-380594 initially ===')
  const { data: initial, error: err1 } = await supabase
    .from('pre_blotters')
    .select('blotter_id, reference_no, status, latitude, longitude, map_status, location_address')
    .eq('reference_no', 'SC-380594')
    .single()

  console.log('Initial record in Supabase:', initial, 'error:', err1)
  if (!initial) throw new Error('SC-380594 not found in pre_blotters!')

  console.log('\n=== TEST 2: Perform GIS Mapping Persistence ===')
  const testLat = 14.6755
  const testLng = 121.0442
  const testLocation = '123 Katipunan Ave., Barangay Milagrosa, Quezon City'

  // Update logic with fallback for is_mapped column
  const pbUpdateWithIsMapped = {
    latitude: testLat,
    longitude: testLng,
    location_address: testLocation,
    map_status: 'Approved',
    map_reviewed_at: new Date().toISOString(),
    is_mapped: true,
    mapped_at: new Date().toISOString(),
  }

  let { data: updatedRows, error: pbErr } = await supabase
    .from('pre_blotters')
    .update(pbUpdateWithIsMapped)
    .eq('blotter_id', initial.blotter_id)
    .select()

  if (pbErr && pbErr.message?.includes('is_mapped')) {
    const pbFallbackUpdate = {
      latitude: testLat,
      longitude: testLng,
      location_address: testLocation,
      map_status: 'Approved',
      map_reviewed_at: new Date().toISOString(),
    }
    const fbRes = await supabase
      .from('pre_blotters')
      .update(pbFallbackUpdate)
      .eq('blotter_id', initial.blotter_id)
      .select()
    updatedRows = fbRes.data
    pbErr = fbRes.error
  }

  console.log('Update result:', { rowsUpdated: updatedRows?.length, error: pbErr })
  if (pbErr || !updatedRows || updatedRows.length === 0) {
    throw new Error('Database update failed!')
  }

  console.log('\n=== TEST 3: Verify Persistence Survives Refetch (Simulating hard page reload) ===')
  const { data: refetched, error: err3 } = await supabase
    .from('pre_blotters')
    .select('blotter_id, reference_no, status, latitude, longitude, map_status, location_address')
    .eq('reference_no', 'SC-380594')
    .single()

  console.log('Refetched record from Supabase:', refetched)
  const rawLat = refetched.latitude != null ? parseFloat(refetched.latitude) : null
  const rawLng = refetched.longitude != null ? parseFloat(refetched.longitude) : null
  const hasValidCoords = rawLat != null && rawLng != null && rawLat >= -90 && rawLat <= 90 && rawLng >= -180 && rawLng <= 180
  const isMapped = hasValidCoords && refetched.map_status === 'Approved'

  console.log('Computed isMapped after reload:', isMapped)
  if (!isMapped) throw new Error('Persistence failed: incident is not mapped after refetch!')

  console.log('\n=== TEST 4: Perform Unmapping Persistence ===')
  let { data: unmappedRows, error: unmapErr } = await supabase
    .from('pre_blotters')
    .update({
      latitude: null,
      longitude: null,
      map_status: 'Pending',
      is_mapped: false,
    })
    .eq('blotter_id', initial.blotter_id)
    .select()

  if (unmapErr && unmapErr.message?.includes('is_mapped')) {
    const fbRes = await supabase
      .from('pre_blotters')
      .update({
        latitude: null,
        longitude: null,
        map_status: 'Pending',
      })
      .eq('blotter_id', initial.blotter_id)
      .select()
    unmappedRows = fbRes.data
    unmapErr = fbRes.error
  }

  console.log('Unmap result:', { rowsUpdated: unmappedRows?.length, error: unmapErr })

  console.log('\n=== TEST 5: Verify Unmapped Persistence Survives Refetch ===')
  const { data: unmappedRefetched } = await supabase
    .from('pre_blotters')
    .select('blotter_id, reference_no, status, latitude, longitude, map_status')
    .eq('reference_no', 'SC-380594')
    .single()

  console.log('Unmapped record from Supabase:', unmappedRefetched)
  const unmappedCoordsValid = unmappedRefetched.latitude != null && unmappedRefetched.longitude != null
  const isUnmapped = !unmappedCoordsValid && unmappedRefetched.map_status === 'Pending'
  console.log('Computed isUnmapped:', isUnmapped)
  if (!isUnmapped) throw new Error('Unmapping failed to persist!')

  console.log('\n✅ ALL DATABASE PERSISTENCE TESTS PASSED SUCCESSFULLY!')
}

testFullPersistence().catch(console.error)
