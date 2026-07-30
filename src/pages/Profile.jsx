import { useState } from 'react'
import { Save, KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'

export default function Profile() {
  const { user, updateUser, changePassword } = useAuth()
  const { addAuditEntry } = useData()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const saveInfo = (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      showToast('Kumpletuhin ang pangalan at email.', 'error')
      return
    }
    updateUser({ name: name.trim(), email: email.trim() })
    addAuditEntry('In-update ang profile information', { color: 'blue' })
    showToast('Na-save ang mga pagbabago sa profile.')
  }

  const submitPasswordChange = (e) => {
    e.preventDefault()
    if (!currentPassword) {
      showToast('Ilagay ang kasalukuyang password.', 'error')
      return
    }
    if (newPassword.length < 8) {
      showToast('Dapat hindi bababa sa 8 karakter ang bagong password.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('Hindi magkatugma ang bagong password.', 'error')
      return
    }
    const result = changePassword({ currentPassword, newPassword })
    if (!result.success) {
      showToast('Mali ang kasalukuyang password.', 'error')
      return
    }
    addAuditEntry('Binago ang sariling password', { color: 'blue' })
    showToast('Na-update ang password.')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Admin Profile</h2>
      <p className="mt-1 text-sm text-gray-500">
        Update security or account information and passwords
      </p>

      <form onSubmit={saveInfo} className="mt-3 max-w-2xl space-y-3 rounded-xl border border-bb-blue/40 p-4">
        <h3 className="font-semibold text-bb-blue">Profile Information</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Pangalan ng Administrator
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Authority Role
            </span>
            <input
              type="text"
              value={user?.role ?? ''}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
            <span className="mt-1 block text-xs text-gray-400">
              Ang tungkulin ay itinatakda lamang ng System Administrator.
            </span>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Email Address
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
          />
        </label>

        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-bb-navy px-5 py-2 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
        >
          <Save size={16} />
          I-save ang Pagbabago
        </button>
      </form>

      <form onSubmit={submitPasswordChange} className="mt-3 max-w-2xl space-y-3 rounded-xl border border-bb-blue/40 p-4">
        <h3 className="flex items-center gap-1.5 font-semibold text-bb-blue">
          <KeyRound size={16} />
          Baguhin ang Password
        </h3>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Kasalukuyang Password
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••••"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Bagong Password
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Kumpirmahin ang Bagong Password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-bb-blue px-5 py-2 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
        >
          <KeyRound size={16} />
          I-update ang Password
        </button>
      </form>
    </div>
  )
}
