import './Profile.css'
import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Camera, KeyRound, Mail, Save, ShieldCheck, Trash2, User as UserIcon } from 'lucide-react'
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
  const [is2faDisabled, setIs2faDisabled] = useState(false)
  const [loading2fa, setLoading2fa] = useState(true)
  const [confirmingDisable2fa, setConfirmingDisable2fa] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return showToast('Pumili ng image file lamang (JPG, PNG, atbp).', 'error')
    if (file.size > MAX_AVATAR_BYTES) return showToast('Dapat hindi lalampas sa 2MB ang larawan.', 'error')
    const reader = new FileReader()
    reader.onload = async () => {
      const result = await updateUser({ avatarUrl: reader.result })
      if (result && !result.success) showToast(result.error || 'Hindi ma-update ang profile picture.', 'error')
      else { addAuditEntry('Nag-upload ng bagong profile picture', { color: 'blue' }); showToast('Na-update ang profile picture.') }
    }
    reader.readAsDataURL(file)
  }

  async function confirmRemoveAvatar() {
    const result = await updateUser({ avatarUrl: null })
    if (result && !result.success) showToast(result.error || 'Hindi maalis ang profile picture.', 'error')
    else { addAuditEntry('Inalis ang profile picture', { color: 'orange' }); showToast('Naalis ang profile picture.') }
  }

  async function saveInfo(event) {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return showToast('Kumpletuhin ang pangalan at email.', 'error')
    const result = await updateUser({ name: name.trim(), email: email.trim() })
    if (result && !result.success) showToast(result.error || 'Hindi ma-save ang mga pagbabago.', 'error')
    else { addAuditEntry('In-update ang profile information', { color: 'blue' }); showToast('Na-save ang mga pagbabago sa profile.') }
  }

  async function submitPasswordChange(event) {
    event.preventDefault()
    if (!currentPassword) return showToast('Ilagay ang kasalukuyang password.', 'error')
    if (newPassword.length < 8) return showToast('Dapat hindi bababa sa 8 karakter ang bagong password.', 'error')
    if (newPassword !== confirmPassword) return showToast('Hindi magkatugma ang bagong password.', 'error')
    const result = await changePassword({ currentPassword, newPassword })
    if (!result?.success) return showToast(result?.error || 'Hindi ma-update ang password.', 'error')
    addAuditEntry('Binago ang sariling password', { color: 'blue' })
    showToast('Na-update ang password.')
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
  }

  useEffect(() => {
    async function fetch2faStatus() {
      if (user?.role !== 'System Administrator') return
      try {
        const { data, error } = await supabase.rpc('is_2fa_disabled')
        if (!error) setIs2faDisabled(Boolean(data))
      } catch (error) { console.error('Error fetching 2FA status:', error) }
      finally { setLoading2fa(false) }
    }
    fetch2faStatus()
  }, [user])

  async function handle2faToggle() {
    if (!is2faDisabled) return setConfirmingDisable2fa(true)
    try {
      const { error } = await supabase.rpc('toggle_2fa', { disable: false })
      if (error) throw error
      setIs2faDisabled(false)
      addAuditEntry('In-enable ang Two-Factor Authentication (2FA)', { color: 'green' })
      showToast('Naka-enable na ang email 2FA verification.')
    } catch (error) { showToast(`Hindi ma-update ang 2FA settings: ${error.message}`, 'error') }
  }

  async function confirmDisable2fa() {
    try {
      const { error } = await supabase.rpc('toggle_2fa', { disable: true })
      if (error) throw error
      setIs2faDisabled(true)
      addAuditEntry('In-disable ang Two-Factor Authentication (2FA)', { color: 'red' })
      showToast('BABALA: Naka-disable na ang email 2FA verification.', 'info')
    } catch (error) { showToast(`Hindi ma-update ang 2FA settings: ${error.message}`, 'error') }
    finally { setConfirmingDisable2fa(false) }
  }

  return <div className="profile-page">
    <aside className="profile-identity-card">
      <div className="profile-avatar-wrap">
        <div className="profile-avatar">{user?.avatarUrl ? <img src={user.avatarUrl} alt={user?.name} /> : <UserIcon size={46} />}</div>
        <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Mag-upload ng profile picture"><Camera size={17} /></button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
      </div>
      <h2>{user?.name}</h2>
      <p className="profile-role"><BadgeCheck size={15} />{user?.role}</p>
      <p className="profile-email"><Mail size={15} />{user?.email}</p>
      <div className="profile-avatar-actions"><button type="button" onClick={() => fileInputRef.current?.click()}><Camera size={15} /> Palitan ang larawan</button>{user?.avatarUrl && <button type="button" onClick={() => setConfirmingRemoveAvatar(true)} className="is-remove"><Trash2 size={15} /> Alisin</button>}</div>
      <p className="profile-file-note">JPG o PNG, hanggang 2MB.</p>
      <dl className="profile-account-summary"><div><dt>Account status</dt><dd><i /> Active</dd></div><div><dt>Security</dt><dd className={is2faDisabled ? 'is-warning' : ''}>{user?.role === 'System Administrator' ? (is2faDisabled ? '2FA disabled' : '2FA protected') : 'Protected'}</dd></div></dl>
    </aside>

    <main className="profile-settings-column">
      <form onSubmit={saveInfo} className="profile-settings-panel">
        <header><span><UserIcon size={19} /></span><div><p>Account details</p><h2>Profile Information</h2><small>I-update ang pangalan at opisyal na contact email.</small></div></header>
        <div className="profile-form-body"><div className="profile-field-grid"><label><span>Pangalan ng Administrator</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Authority Role</span><input value={user?.role ?? ''} disabled /><small>System Administrator lamang ang maaaring magtakda nito.</small></label></div><label><span>Email Address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><div className="profile-form-actions"><button type="submit"><Save size={16} /> I-save ang Pagbabago</button></div></div>
      </form>

      <form onSubmit={submitPasswordChange} className="profile-settings-panel">
        <header><span><KeyRound size={19} /></span><div><p>Sign-in security</p><h2>Baguhin ang Password</h2><small>Gumamit ng hindi bababa sa walong karakter.</small></div></header>
        <div className="profile-form-body"><label><span>Kasalukuyang Password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Ilagay ang kasalukuyang password" /></label><div className="profile-field-grid"><label><span>Bagong Password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Hindi bababa sa 8 karakter" /></label><label><span>Kumpirmahin ang Bagong Password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Ulitin ang bagong password" /></label></div><div className="profile-form-actions"><button type="submit"><KeyRound size={16} /> I-update ang Password</button></div></div>
      </form>

      {user?.role === 'System Administrator' && <section className="profile-settings-panel profile-security-panel">
        <header><span><ShieldCheck size={19} /></span><div><p>System-wide protection</p><h2>Two-Factor Authentication</h2><small>Email verification para sa lahat ng administrator.</small></div></header>
        <div className="profile-security-body">{loading2fa ? <p className="profile-security-loading">Pina-process ang settings...</p> : <><div><strong>Email 2FA Verification</strong><p>{is2faDisabled ? 'Naka-disable. Mas mababa ang seguridad ng portal.' : 'Naka-enable at inirerekomenda para sa lahat ng admin.'}</p></div><button type="button" role="switch" aria-checked={!is2faDisabled} onClick={handle2faToggle} className={!is2faDisabled ? 'is-enabled' : ''}><span /></button></>}</div>
      </section>}
    </main>

    <ConfirmDialog open={confirmingDisable2fa} onClose={() => setConfirmingDisable2fa(false)} onConfirm={confirmDisable2fa} title="BABALA: I-disable ang Email 2FA?" message="Sigurado ka bang gusto mong patayin ang Two-Factor Authentication? Mapapababa nito ang seguridad ng portal." confirmLabel="Oo, I-disable" />
    <ConfirmDialog open={confirmingRemoveAvatar} onClose={() => setConfirmingRemoveAvatar(false)} onConfirm={confirmRemoveAvatar} title="Alisin ang Profile Picture" message="Sigurado ka bang gusto mong alisin ang iyong profile picture? Babalik ito sa default na icon." confirmLabel="Alisin" />
  </div>
}
