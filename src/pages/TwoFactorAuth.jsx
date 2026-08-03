import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { supabase } from '../lib/supabaseClient'
import { ShieldCheck, Mail, ArrowLeft, RefreshCw } from 'lucide-react'

export default function TwoFactorAuth() {
  const { user, logout } = useAuth()
  const { addAuditEntry } = useData()
  const navigate = useNavigate()
  
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [timer, setTimer] = useState(300) // 5 minutes countdown (300 seconds)
  const [isSending, setIsSending] = useState(false)
  const inputRefs = useRef([])
  const isVerifying = useRef(false)


  const hasSent = useRef(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  // Trigger the 2FA code email sending on page load
  useEffect(() => {
    if (user?.email && !hasSent.current) {
      hasSent.current = true
      sendOtpCode()
    }
  }, [user?.email])


  // Countdown timer logic
  useEffect(() => {
    if (timer <= 0) return
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timer])

  // Call Supabase RPC to trigger sending the OTP via Resend
  const sendOtpCode = async () => {
    if (isSending || !user?.email) return
    setIsSending(true)
    setError('')
    setSuccessMsg('')
    
    try {
      const { data, error: rpcError } = await supabase.rpc('send_2fa_code', {
        admin_email: user.email
      })

      if (rpcError) throw rpcError

      setSuccessMsg('Napadala na ang verification code sa iyong email.')
      setTimer(300) // Reset timer to 5 minutes
    } catch (err) {
      console.error('Error sending OTP:', err)
      setError('Hindi maipadala ang code. Siguraduhing naka-setup ang Resend API key sa iyong database.')
    } finally {
      setIsSending(false)
    }
  }

  // Handle number input change
  const handleChange = (index, value) => {
    if (isNaN(value)) return // Only allow numbers
    
    const newCode = [...code]
    // Only take the last character typed
    newCode[index] = value.substring(value.length - 1)
    setCode(newCode)

    // Automatically focus next input if filled
    if (value && index < 5) {
      inputRefs.current[index + 1].focus()
    }
  }

  // Handle backspace key press
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus()
    }
  }

  // Handle paste code
  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()
    if (pastedData.length === 6 && /^\d+$/.test(pastedData)) {
      const newCode = pastedData.split('')
      setCode(newCode)
      inputRefs.current[5].focus()
    }
  }

  // Submit the verification code
  const handleVerify = async (e) => {
    if (e) e.preventDefault()
    
    // Prevent double verification requests
    if (isVerifying.current) return
    
    const otpString = code.join('')
    if (otpString.length !== 6) {
      setError('Pakikumpleto ang 6-digit verification code.')
      return
    }

    isVerifying.current = true
    setLoading(true)
    setError('')
    setSuccessMsg('')

    try {
      console.log('Sending verification request:', {
        email: user?.email,
        code: otpString
      })

      const { data: verified, error: rpcError } = await supabase.rpc('verify_2fa_code', {
        admin_email: user?.email,
        input_code: otpString
      })

      console.log('Verification response:', { verified, error: rpcError })

      if (rpcError) throw rpcError

      if (verified) {
        // Mark as 2FA verified in sessionStorage
        sessionStorage.setItem('2fa_verified', 'true')
        
        // Log audit log
        addAuditEntry('2FA Verification', {
          actorName: user.name,
          actorRole: user.role,
          color: 'green',
        })

        // Redirect to first-login change page or dashboard
        if (user.mustChangePassword) {
          navigate('/first-login')
        } else {
          navigate('/dashboard')
        }
      } else {
        setError('Maling code o expired na ito. Mangyaring subukan muli.')
        setCode(['', '', '', '', '', ''])
        isVerifying.current = false // Allow retry on failure
        setTimeout(() => {
          if (inputRefs.current[0]) {
            inputRefs.current[0].focus()
          }
        }, 50)
      }
    } catch (err) {
      console.error('Error verifying OTP:', err)
      setError('Nagka-error sa pag-verify ng code. Pakisubukan muli.')
      isVerifying.current = false // Allow retry on failure
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit when all 6 numbers are typed
  useEffect(() => {
    if (code.every((val) => val !== '')) {
      handleVerify()
    }
  }, [code])


  // Mask user email for display
  const maskEmail = (emailAddress) => {
    if (!emailAddress) return ''
    const [local, domain] = emailAddress.split('@')
    if (local.length <= 2) return `${local[0]}*@${domain}`
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`
  }

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleBackToLogin = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bb-blue px-6 py-10 sm:px-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-white backdrop-blur-xl shadow-2xl">
        
        {/* Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-white/10 p-3.5 ring-4 ring-white/5">
            <ShieldCheck className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold">2FA Verification</h2>
          <p className="mt-2 text-sm text-white/70">
            Seguridad ng Account: Ipinadala namin ang isang one-time code sa iyong registered email address.
          </p>
        </div>

        {/* Email Display */}
        <div className="mb-6 flex items-center justify-center gap-2.5 rounded-lg bg-white/10 px-4 py-3 border border-white/5 text-sm font-semibold">
          <Mail className="h-4.5 w-4.5 text-white/60" />
          <span>{user?.email ? maskEmail(user.email) : ''}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-6">
          
          {/* OTP Input Fields */}
          <div>
            <span className="mb-2 block text-center text-sm font-semibold text-white/80">
              Ilagay ang 6-digit Code
            </span>
            <div className="flex justify-between gap-2" onPaste={handlePaste}>
              {code.map((num, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  maxLength={1}
                  value={num}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={loading}
                  className="h-12 w-12 text-center text-xl font-bold rounded-lg border border-white/20 bg-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:bg-white/15 focus:border-transparent transition-all disabled:opacity-50"
                  placeholder="-"
                  required
                />
              ))}
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="rounded-lg bg-red-500/20 px-3.5 py-2.5 text-xs font-semibold text-red-200 border border-red-500/30">
              {error}
            </div>
          )}

          {successMsg && !error && (
            <div className="rounded-lg bg-green-500/20 px-3.5 py-2.5 text-xs font-semibold text-green-200 border border-green-500/30">
              {successMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={loading || code.some((val) => val === '')}
              className="w-full rounded-lg bg-gradient-to-b from-bb-navy to-bb-navy/90 border border-bb-navy/10 shadow-sm py-3 font-semibold text-sm hover:from-bb-blue-dark hover:to-bb-blue-dark transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? 'Pina-process...' : 'I-verify at Magpatuloy'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              {timer > 0 ? (
                <span className="text-white/60">
                  Magpadala muli sa loob ng: <strong className="text-white font-bold">{formatTimer(timer)}</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={sendOtpCode}
                  disabled={isSending}
                  className="flex items-center gap-1 font-bold text-white hover:underline transition-all hover:text-white/80 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isSending ? 'animate-spin' : ''}`} />
                  Magpadala Muli
                </button>
              )}

              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex items-center gap-1 font-semibold text-white/70 hover:text-white hover:underline"
              >
                <ArrowLeft className="h-3 w-3" />
                Bumalik sa Login
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  )
}
