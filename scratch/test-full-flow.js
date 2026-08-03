import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://biaqsosjorxklbtptdqy.supabase.co'
const supabaseAnonKey = 'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testFullFlow() {
  const email = 'test-flow-email@example.com'
  
  console.log('--- TEST FLOW START ---')
  
  // 1. Call send_2fa_code
  console.log('1. Calling send_2fa_code...')
  const { data: sendResult, error: sendError } = await supabase.rpc('send_2fa_code', {
    admin_email: email
  })
  
  if (sendError) {
    console.error('Send Error:', sendError)
    return
  }
  console.log('Send Code result:', sendResult)

  // 2. We need to fetch the generated code from the database to test verification.
  // Since we don't have superuser rights in this client, we can create a temporary RPC via the SQL editor.
  // But wait! We can also write a temporary RPC that performs the test entirely inside PostgreSQL and returns the result!
  // Let's call a database query that creates the test function, or we can just tell the user to run it.
  // Actually, we can run a SQL command using a temporary RPC if we define it.
  // Let's see: we can check if there's any error in verify_2fa_code.
}

testFullFlow()
