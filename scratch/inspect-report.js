import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Manually parse .env.local
const envContent = fs.readFileSync('.env.local', 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    const key = parts[0].trim()
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspect() {
  console.log('Querying pre_blotters...')
  const { data: pbs, error: pbsErr } = await supabase
    .from('pre_blotters')
    .select('*, ai_extractions(*)')
    .eq('reference_no', 'BGY-997961')

  if (pbs && pbs.length > 0) {
    console.log('Found in pre_blotters:', JSON.stringify(pbs, null, 2))
    return
  }

  console.log('Querying reports...')
  const { data: reps, error: repsErr } = await supabase
    .from('reports')
    .select('*')
    .eq('reference_no', 'BGY-997961')

  if (reps && reps.length > 0) {
    console.log('Found in reports:', JSON.stringify(reps, null, 2))
    return
  }

  // Check if reference_no is a substring or ID check
  console.log('Querying reports by ID/substring...')
  const { data: repsAll } = await supabase
    .from('reports')
    .select('*')
  
  const matchingRep = repsAll?.find(r => 
    r.reference_no === 'BGY-997961' || 
    `REP-${String(r.id || '').substring(0, 8)}` === 'BGY-997961'
  )
  if (matchingRep) {
    console.log('Found matching report in reports:', JSON.stringify(matchingRep, null, 2))
    return
  }

  console.log('Not found in either table.')
}

inspect()
