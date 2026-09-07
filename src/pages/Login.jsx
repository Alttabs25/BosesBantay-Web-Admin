import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import LoginLoadingScreen from '../components/LoginLoadingScreen'

export default function Login() {
  const { login } = useAuth()
  const { addAuditEntry } = useData()
  const navigate = useNavigate()
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginTransition, setLoginTransition] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting || loginTransition) return

    setError('')
    setIsSubmitting(true)

    try {
      const result = await login({ email: credential, password })

      if (!result.success) {
        setError('Maling email o password.')
        setIsSubmitting(false)
        return
      }

      // Clear any previous 2FA session status if 2FA is active
      if (!result.is2faDisabled) {
        sessionStorage.removeItem('2fa_verified')
      }

      addAuditEntry(result.is2faDisabled ? 'Login' : 'Login Attempt', {
        actorName: result.user.name,
        actorRole: result.user.role,
        color: 'blue',
      })

      const targetPath = result.is2faDisabled
        ? result.user.mustChangePassword
          ? '/first-login'
          : '/dashboard'
        : '/2fa'

      // Activate the full-screen cinematic loading transition
      setLoginTransition({
        user: result.user,
        is2fa: !result.is2faDisabled,
        targetPath,
      })
    } catch (err) {
      console.error('Login error:', err)
      setError('Nagkaroon ng problema sa pag-login. Pakisubukan muli.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {loginTransition && (
        <LoginLoadingScreen
          user={loginTransition.user}
          is2fa={loginTransition.is2fa}
          onComplete={() => navigate(loginTransition.targetPath)}
        />
      )}

      <div className="flex min-h-screen w-full flex-col md:h-screen md:w-screen md:flex-row">
        <div className="flex w-full flex-col items-center justify-center gap-4 bg-white px-6 py-10 text-center sm:px-12 md:w-1/2">
          <img src="/logo-icon.png" alt="BosesBantay logo" className="h-20 w-20 object-contain" />
          <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl">
            ADMINISTRATIVE
            <br />
            COMMAND CENTER
          </h1>
          <p className="max-w-sm text-sm text-gray-500">
            AI-Assisted Barangay Documentation and Local Governance Hub. Speak
            naturally. Report instantly.
          </p>
        </div>

        <div className="flex w-full items-center justify-center bg-bb-blue px-6 py-10 sm:px-12 md:w-1/2">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm space-y-5 text-white"
          >
            <div className="mb-6 flex items-center gap-3">
              <img src="/logo-icon.png" alt="BosesBantay logo" className="h-10 w-10 object-contain" />
              <h2 className="text-2xl font-bold">Admin Login</h2>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Opisyal na Kredensyal
              </span>
              <input
                type="email"
                required
                disabled={isSubmitting || !!loginTransition}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="captain.***@quezoncity.gov.ph"
                className="w-full rounded-lg border-0 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60 transition-opacity"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Password
              </span>
              <input
                type="password"
                required
                disabled={isSubmitting || !!loginTransition}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full rounded-lg border-0 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60 transition-opacity"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-medium text-white border border-red-500/30">
                {error}
              </p>
            )}

            <div className="text-right">
              <Link to="/forgot-password" className="text-sm font-semibold text-white/85 hover:text-white hover:underline">
                Nakalimutan ang Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !!loginTransition}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-bb-navy to-bb-navy/90 border border-bb-navy/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-3 font-semibold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Sinusuri ang kredensyal...</span>
                </>
              ) : (
                <span>Mag-Login</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
