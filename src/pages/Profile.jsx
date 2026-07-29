import { useState } from 'react'
import { Mail, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState(user?.role ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const requestCode = () => {
    if (!email.trim()) {
      showToast('Maglagay muna ng email address.', 'error')
      return
    }
    showToast(`Naipadala ang verification code sa ${email}.`)
  }

  const saveChanges = (e) => {
    e.preventDefault()

    if (!name.trim() || !role.trim() || !email.trim()) {
      showToast('Kumpletuhin ang pangalan, tungkulin, at email.', 'error')
      return
    }
    if (password && password !== confirmPassword) {
      showToast('Hindi magkatugma ang password.', 'error')
      return
    }

    updateUser({ name: name.trim(), role: role.trim(), email: email.trim() })
    setPassword('')
    setConfirmPassword('')
    showToast('Na-save ang mga pagbabago sa profile.')
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Admin Profile</h2>
      <p className="mt-1 text-sm text-gray-500">
        Update security or account information and passwords
      </p>

      <form onSubmit={saveChanges} className="mt-4 max-w-2xl space-y-5 rounded-xl border border-bb-blue/40 p-6">
        <h3 className="font-semibold text-bb-blue">Profile Information</h3>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Pangalan ng Administrator
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Authority Role
            </span>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
          />
        </label>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Confirmed Password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-bb-navy px-5 py-2.5 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
          >
            <Save size={16} />
            I-save ang Pagbabago
          </button>

          <button
            type="button"
            onClick={requestCode}
            className="flex items-center gap-2 rounded-lg bg-bb-blue px-5 py-2.5 font-semibold text-white hover:bg-bb-blue-dark transition-colors"
          >
            <Mail size={16} />
            Humiling ng Email Verification Code
          </button>
        </div>
      </form>
    </div>
  )
}
