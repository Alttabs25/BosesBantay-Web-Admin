import { useRef, useState, useEffect } from 'react'
import { Save, KeyRound, User as UserIcon, Camera, Trash2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabaseClient'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export default function Profile() {
  const { user, updateUser, changePassword } = useAuth()
  const { addAuditEntry } = useData()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const fileInputRef = useRef(null)
  const [confirmingRemoveAvatar, setConfirmingRemoveAvatar] = useState(false)

  // 2FA Toggler settings
  const [is2faDisabled, setIs2faDisabled] = useState(false)
  const [loading2fa, setLoading2fa] = useState(true)
  const [confirmingDisable2fa, setConfirmingDisable2fa] = useState(false)

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

  // Load 2FA disabled status
  useEffect(() => {
    const fetch2faStatus = async () => {
      if (user?.role === 'System Administrator') {
        try {
          const { data, error } = await supabase.rpc('is_2fa_disabled')
          if (!error) {
            setIs2faDisabled(!!data)
          }
        } catch (e) {
          console.error('Error fetching 2FA status:', e)
        } finally {
          setLoading2fa(false)
        }
      }
    }
    fetch2faStatus()
  }, [user])

  const handle2faToggle = async () => {
    // If currently disabled, turn it ON (set disable = false)
    if (is2faDisabled) {
      try {
        const { error } = await supabase.rpc('toggle_2fa', { disable: false })
        if (error) throw error
        setIs2faDisabled(false)
        addAuditEntry('In-enable ang Two-Factor Authentication (2FA)', { color: 'green' })
        showToast('Naka-enable na ang email 2FA verification.')
      } catch (err) {
        showToast('Hindi ma-update ang 2FA settings: ' + err.message, 'error')
      }
    } else {
      // If currently enabled, show warning to disable it
      setConfirmingDisable2fa(true)
    }
  }

  const confirmDisable2fa = async () => {
    try {
      const { error } = await supabase.rpc('toggle_2fa', { disable: true })
      if (error) throw error
      setIs2faDisabled(true)
      addAuditEntry('In-disable ang Two-Factor Authentication (2FA)', { color: 'red' })
      showToast('BABALA: Naka-disable na ang email 2FA verification.', 'info')
    } catch (err) {
      showToast('Hindi ma-update ang 2FA settings: ' + err.message, 'error')
    } finally {
      setConfirmingDisable2fa(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-4 pb-12">
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

      {user?.role === 'System Administrator' && (
        <div className="mt-3 max-w-2xl rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-red-700">
            <ShieldCheck size={18} className="text-red-600" />
            Two-Factor Authentication (2FA) Settings
          </h3>
          <p className="text-xs text-gray-500">
            Pagpapasya para sa buong system. Kapag naka-on, ang lahat ng admin ay hihingan ng email code bago makapasok.
          </p>

          {loading2fa ? (
            <div className="text-xs text-gray-400">Pina-process ang settings...</div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-white border border-gray-200 p-3 shadow-sm">
              <div>
                <span className="block text-sm font-semibold text-gray-800">
                  I-activate ang Email 2FA Verification
                </span>
                <span className="text-xs text-gray-500">
                  {!is2faDisabled 
                    ? 'Naka-on kasalukuyan (Inirerekomenda)' 
                    : 'Naka-deactivate kasalukuyan (Mababa ang seguridad)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handle2faToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !is2faDisabled ? 'bg-bb-blue' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !is2faDisabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmingDisable2fa}
        onClose={() => setConfirmingDisable2fa(false)}
        onConfirm={confirmDisable2fa}
        title="BABALA: I-disable ang Email 2FA?"
        message="Sigurado ka bang gusto mong patayin ang Two-Factor Authentication (2FA)? Mapapababa nito ang seguridad ng portal, at ang sinumang may alam sa password ay makakapasok na nang walang email verification code."
        confirmLabel="Oo, I-disable"
      />

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
