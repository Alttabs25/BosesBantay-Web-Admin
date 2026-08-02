import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'

export default function FirstLoginPasswordChange() {
  const { user, completeFirstLogin, logout } = useAuth()
  const { addAuditEntry } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      showToast('Dapat hindi bababa sa 8 karakter ang bagong password.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Hindi magkatugma ang password.', 'error')
      return
    }
    completeFirstLogin(newPassword)
    addAuditEntry('Binago ang pansamantalang password sa unang pag-login', { color: 'blue' })
    showToast('Na-set ang bagong password.')
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-bb-blue px-6 py-10">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bb-blue-light text-bb-blue">
          <KeyRound size={22} />
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Kailangang Baguhin ang Password
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Hi {user?.name}. Naka-log in ka gamit ang isang pansamantalang password.
          Bago ka magpatuloy sa Command Center, kailangan mo munang mag-set ng
          sarili mong bagong password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Bagong Password
            </span>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Kumpirmahin ang Password
            </span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
          <p className="text-xs text-gray-400">Dapat hindi bababa sa 8 karakter.</p>

          <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-b from-bb-navy to-bb-navy/90 border border-bb-navy/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-3 font-semibold text-white transition-all active:scale-[0.98]"
          >
            I-set ang Bagong Password
          </button>

          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-gray-400 hover:text-gray-600"
          >
            <LogOut size={14} />
            Mag-log out muna
          </button>
        </form>
      </div>
    </div>
  )
}
