import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://biaqsosjorxklbtptdqy.supabase.co',
  'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'
)

async function main() {
  const { data: users } = await supabase.from('users').select('id, email, first_name, last_name, roles(role_name)')
  console.log('Users in DB:', users?.map(u => ({ email: u.email, name: `${u.first_name} ${u.last_name}`, role: u.roles?.role_name })))
}

main().catch(console.error)
