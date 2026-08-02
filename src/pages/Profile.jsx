import { useRef, useState } from 'react'
import { Save, KeyRound, User as UserIcon, Camera, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export default function Profile() {
  const { user, updateUser, changePassword } = useAuth()
  const { addAuditEntry } = useData()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const fileInputRef = useRef(null)
  const [confirmingRemoveAvatar, setConfirmingRemoveAvatar] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Pumili ng image file lamang (JPG, PNG, atbp).', 'error')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast('Dapat hindi lalampas sa 2MB ang larawan.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const res = await updateUser({ avatarUrl: reader.result })
      if (res && !res.success) {
        showToast(res.error || 'Hindi ma-update ang profile picture.', 'error')
      } else {
        addAuditEntry('Nag-upload ng bagong profile picture', { color: 'blue' })
        showToast('Na-update ang profile picture.')
      }
    }
    reader.readAsDataURL(file)
  }

  const confirmRemoveAvatar = async () => {
    const res = await updateUser({ avatarUrl: null })
    if (res && !res.success) {
      showToast(res.error || 'Hindi maalis ang profile picture.', 'error')
    } else {
      addAuditEntry('Inalis ang profile picture', { color: 'orange' })
      showToast('Naalis ang profile picture.')
    }
  }

  const saveInfo = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      showToast('Kumpletuhin ang pangalan at email.', 'error')
      return
    }
    const res = await updateUser({ name: name.trim(), email: email.trim() })
    if (res && !res.success) {
      showToast(res.error || 'Hindi ma-save ang mga pagbabago.', 'error')
    } else {
      addAuditEntry('In-update ang profile information', { color: 'blue' })
      showToast('Na-save ang mga pagbabago sa profile.')
    }
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

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bb-blue-light text-bb-blue">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user?.name} className="h-full w-full object-cover" />
            ) : (
              <UserIcon size={28} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-[0.98]"
            >
              <Camera size={13} />
              Mag-upload ng Larawan
            </button>
            {user?.avatarUrl && (
              <button
                type="button"
                onClick={() => setConfirmingRemoveAvatar(true)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-gray-200 to-gray-300/80 border border-gray-200/20 shadow-sm hover:shadow hover:from-gray-300 hover:to-gray-400 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-700 transition-all active:scale-[0.98]"
              >
                <Trash2 size={13} />
                Alisin
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <span className="w-full text-xs text-gray-400">JPG o PNG, hanggang 2MB.</span>
          </div>
        </div>

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
          className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-bb-navy to-bb-navy/90 border border-bb-navy/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-5 py-2 font-semibold text-white transition-all active:scale-[0.98]"
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
          className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark px-5 py-2 font-semibold text-white transition-all active:scale-[0.98]"
        >
          <KeyRound size={16} />
          I-update ang Password
        </button>
      </form>

      <ConfirmDialog
        open={confirmingRemoveAvatar}
        onClose={() => setConfirmingRemoveAvatar(false)}
        onConfirm={confirmRemoveAvatar}
        title="Alisin ang Profile Picture"
        message="Sigurado ka bang gusto mong alisin ang iyong profile picture? Babalik ito sa default na icon."
        confirmLabel="Alisin"
      />
    </div>
  )
}
