import { createClient } from '@supabase/supabase-js'

// Read env variables
const supabaseUrl = 'https://biaqsosjorxklbtptdqy.supabase.co'
const supabaseAnonKey = 'sb_publishable_EY__9MI8-2_PKhUV5UoDbA_GpDrGilW' // from .env.local

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const email = 'richard.bosesbantay@gmail.com' // Let's use a dummy email to test or check
  console.log('Testing 2FA functions...')
  
  // 1. Send OTP
  console.log('Calling send_2fa_code for:', email)
  const { data: sent, error: sendError } = await supabase.rpc('send_2fa_code', {
    admin_email: email
  })
  
  if (sendError) {
    console.error('Send Error:', sendError)
    return
  }
  console.log('Send Code result:', sent)

  // 2. Since we don't know the generated code (unless we check DB, but RLS blocks direct select), 
  // let's try to verify with a dummy code.
  console.log('Calling verify_2fa_code with dummy code 123456...')
  const { data: verified, error: verifyError } = await supabase.rpc('verify_2fa_code', {
    admin_email: email,
    input_code: '123456'
  })
  
  if (verifyError) {
    console.error('Verify Error:', verifyError)
    return
  }
  console.log('Verify Code result (expected false):', verified)
}

test()
