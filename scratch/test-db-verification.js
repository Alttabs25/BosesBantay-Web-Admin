import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://biaqsosjorxklbtptdqy.supabase.co'
const supabaseAnonKey = 'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testVerification() {
  const email = 'richard.bosesbantay@gmail.com'
  
  // 1. Send OTP (this will insert a random code and send email)
  console.log('Sending OTP to:', email)
  const { data: sent, error: sendError } = await supabase.rpc('send_2fa_code', {
    admin_email: email
  })
  
  if (sendError) {
    console.error('Send Error:', sendError)
    return
  }
  console.log('OTP Send returned:', sent)

  // 2. We want to read what code was generated. But RLS prevents select on temp_2fa_codes.
  // Wait, let's create a temporary Postgres function to retrieve the code for testing,
  // or let's verify if the code verification function itself works if we know the code.
  // Since we cannot read it directly, we can create a temporary RPC 'get_latest_otp' for debugging.
  console.log('Creating a debug function to retrieve the code...')
  // We cannot create functions from anon client. We have to do it in SQL editor, or we can check
  // if we can call verify with a code we insert using a custom sql script.
  // Wait, if we can run a node script to test it, let's see.
}

testVerification()
