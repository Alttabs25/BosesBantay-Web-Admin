import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'

export default function ForgotPassword() {
  const { requestPasswordReset, resetPasswordWithCode } = useAuth()
  const { addAuditEntry } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState('email') // 'email' | 'reset'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState('')

  const requestCode = (e) => {
    e.preventDefault()
    const result = requestPasswordReset(email)
    // Same message either way — never confirm/deny whether an email is registered.
    setNotice(
      'Kung nakarehistro ang email na ito bilang admin account, ipinadala namin dito ang isang verification code.',
    )
    if (result.found) {
      showToast(`(Demo lang, walang tunay na email) Verification code: ${result.code}`)
    }
    setStep('reset')
  }

  const resetPassword = (e) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      showToast('Dapat hindi bababa sa 8 karakter ang bagong password.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Hindi magkatugma ang password.', 'error')
      return
    }
    const result = resetPasswordWithCode({ email, code, newPassword })
    if (!result.success) {
      showToast('Mali ang verification code o email.', 'error')
      return
    }
    addAuditEntry(`Nag-reset ng password gamit ang forgot-password flow (${email})`, { color: 'blue' })
    showToast('Na-reset ang password. Maaari ka nang mag-login.')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:h-screen md:w-screen md:flex-row">
      <div className="flex w-full flex-col items-center justify-center gap-4 bg-white px-6 py-10 text-center sm:px-12 md:w-1/2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bb-blue-light">
          <div className="h-9 w-9 rounded-full border-4 border-bb-blue" />
        </div>
        <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">
          PASSWORD RECOVERY
        </h1>
        <p className="max-w-sm text-sm text-gray-500">
          I-verify ang iyong pagkakakilanlan gamit ang iyong nakarehistrong
          email para makabalik sa Administrative Command Center.
        </p>
      </div>

      <div className="flex w-full items-center justify-center bg-bb-blue px-6 py-10 sm:px-12 md:w-1/2">
        <div className="w-full max-w-sm text-white">
          <Link
            to="/login"
            className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-white/85 hover:text-white"
          >
            <ArrowLeft size={15} />
            Bumalik sa Login
          </Link>

          {step === 'email' ? (
            <form onSubmit={requestCode} className="space-y-5">
              <h2 className="text-2xl font-bold">Nakalimutan ang Password?</h2>
              <p className="text-sm text-white/80">
                I-type ang iyong nakarehistrong email — magpapadala kami ng
                verification code doon.
              </p>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Email Address</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="captain.***@quezoncity.gov.ph"
                  className="w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-b from-bb-navy to-bb-navy/90 border border-bb-navy/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-3 font-semibold transition-all active:scale-[0.98]"
              >
                Ipadala ang Verification Code
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-5">
              <h2 className="text-2xl font-bold">I-reset ang Password</h2>
              {notice && <p className="text-sm text-white/80">{notice}</p>}

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Verification Code</span>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Bagong Password</span>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Kumpirmahin ang Password</span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full rounded-lg border-0 px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-b from-bb-navy to-bb-navy/90 border border-bb-navy/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-3 font-semibold transition-all active:scale-[0.98]"
              >
                I-reset ang Password
              </button>

              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-center text-sm font-semibold text-white/70 hover:text-white"
              >
                Ibang email? Bumalik
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
