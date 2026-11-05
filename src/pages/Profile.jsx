import './Profile.css'
import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, CalendarDays, Camera, KeyRound, Landmark, Mail, MapPin, Phone, Save, ShieldCheck, Trash2, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { supabase } from '../lib/supabaseClient'
import { ROLES, roleDisplayName } from '../config/permissions'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

function ageFromBirthdate(value) {
  if (!value) return ''
  const birthdate = new Date(`${value}T00:00:00`)
  if (Number.isNaN(birthdate.getTime())) return ''
  const today = new Date()
  let age = today.getFullYear() - birthdate.getFullYear()
  const monthDifference = today.getMonth() - birthdate.getMonth()
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthdate.getDate())) age -= 1
  return age >= 0 ? String(age) : ''
}

export default function Profile() {
  const { user, updateUser, changePassword } = useAuth()
  const { addAuditEntry } = useData()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [gender, setGender] = useState(user?.gender ?? '')
  const [civilStatus, setCivilStatus] = useState(user?.civilStatus ?? '')
  const [birthdate, setBirthdate] = useState(user?.birthdate ?? '')
  const [mobileNumber, setMobileNumber] = useState(user?.mobileNumber ?? '')
  const [address, setAddress] = useState(user?.address ?? '')
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
      else { addAuditEntry('Nag-upload ng bagong profile picture', { color: 'blue', eventType: 'profile_avatar_update', targetTable: 'users', targetKey: user?.id, after: { avatar_updated: true } }); showToast('Na-update ang profile picture.') }
    }
    reader.readAsDataURL(file)
  }

  async function confirmRemoveAvatar() {
    const result = await updateUser({ avatarUrl: null })
    if (result && !result.success) showToast(result.error || 'Hindi maalis ang profile picture.', 'error')
    else { addAuditEntry('Inalis ang profile picture', { color: 'orange', eventType: 'profile_avatar_remove', targetTable: 'users', targetKey: user?.id, before: { avatar_present: true }, after: { avatar_present: false } }); showToast('Naalis ang profile picture.') }
  }

  async function saveInfo(event) {
    event.preventDefault()
    if (!name.trim() || !email.trim()) return showToast('Kumpletuhin ang pangalan at email.', 'error')
    const result = await updateUser({ name: name.trim(), email: email.trim(), gender, civilStatus, birthdate, mobileNumber: mobileNumber.trim(), address: address.trim() })
    if (result && !result.success) showToast(result.error || 'Hindi ma-save ang mga pagbabago.', 'error')
    else { addAuditEntry('In-update ang profile information', { color: 'blue', eventType: 'profile_update', targetTable: 'users', targetKey: user?.id, before: { display_name_changed: name.trim() !== user?.name, contact_email_changed: email.trim() !== user?.email }, after: { profile_saved: true, personal_details_updated: true } }); showToast('Na-save ang mga pagbabago sa profile.') }
  }

  async function submitPasswordChange(event) {
    event.preventDefault()
    if (!currentPassword) return showToast('Ilagay ang kasalukuyang password.', 'error')
    if (newPassword.length < 8) return showToast('Dapat hindi bababa sa 8 karakter ang bagong password.', 'error')
    if (newPassword !== confirmPassword) return showToast('Hindi magkatugma ang bagong password.', 'error')
    const result = await changePassword({ currentPassword, newPassword })
    if (!result?.success) return showToast(result?.error || 'Hindi ma-update ang password.', 'error')
    addAuditEntry('Binago ang sariling password', { color: 'blue', eventType: 'password_change', targetTable: 'users', targetKey: user?.id, after: { password_changed: true, password_value: '[redacted]' } })
    showToast('Na-update ang password.')
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
  }

  useEffect(() => {
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setGender(user?.gender ?? '')
    setCivilStatus(user?.civilStatus ?? '')
    setBirthdate(user?.birthdate ?? '')
    setMobileNumber(user?.mobileNumber ?? '')
    setAddress(user?.address ?? '')
  }, [user?.id, user?.name, user?.email, user?.gender, user?.civilStatus, user?.birthdate, user?.mobileNumber, user?.address])

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
      addAuditEntry('In-enable ang Two-Factor Authentication (2FA)', { color: 'green', eventType: 'security_setting_update', targetTable: 'users', targetKey: user?.id, before: { email_2fa_enabled: false }, after: { email_2fa_enabled: true } })
      showToast('Naka-enable na ang email 2FA verification.')
    } catch (error) { showToast(`Hindi ma-update ang 2FA settings: ${error.message}`, 'error') }
  }

  async function confirmDisable2fa() {
    try {
      const { error } = await supabase.rpc('toggle_2fa', { disable: true })
      if (error) throw error
      setIs2faDisabled(true)
      addAuditEntry('In-disable ang Two-Factor Authentication (2FA)', { color: 'red', eventType: 'security_setting_update', targetTable: 'users', targetKey: user?.id, before: { email_2fa_enabled: true }, after: { email_2fa_enabled: false } })
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
      <p className="profile-role"><BadgeCheck size={15} />{roleDisplayName(user?.role)}</p>
      {user?.role === ROLES.KAGAWAD && <p className="profile-committee"><Landmark size={15} />{user?.committeeName || (user?.committeeId ? `Committee ${user.committeeId}` : 'No committee assigned')}</p>}
      <p className="profile-email"><Mail size={15} />{user?.email}</p>
      <div className="profile-avatar-actions"><button type="button" onClick={() => fileInputRef.current?.click()}><Camera size={15} /> Palitan ang larawan</button>{user?.avatarUrl && <button type="button" onClick={() => setConfirmingRemoveAvatar(true)} className="is-remove"><Trash2 size={15} /> Alisin</button>}</div>
      <p className="profile-file-note">JPG o PNG, hanggang 2MB.</p>
      <dl className="profile-account-summary"><div><dt>Account status</dt><dd><i /> Active</dd></div>{user?.role === ROLES.KAGAWAD && <div><dt>Committee scope</dt><dd className={!user?.committeeId ? 'is-warning' : ''}>{user?.committeeName || (user?.committeeId ? `Committee ${user.committeeId}` : 'Unassigned')}</dd></div>}<div><dt>Security</dt><dd className={is2faDisabled ? 'is-warning' : ''}>{user?.role === 'System Administrator' ? (is2faDisabled ? '2FA disabled' : '2FA protected') : 'Protected'}</dd></div></dl>
    </aside>

    <main className="profile-settings-column">
      <form onSubmit={saveInfo} className="profile-settings-panel">
        <header><span><UserIcon size={19} /></span><div><p>Account details</p><h2>Profile Information</h2><small>I-update ang opisyal at personal na impormasyon ng iyong account.</small></div></header>
        <div className="profile-form-body">
          <div className="profile-field-grid"><label><span>Pangalan ng Administrator</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Authority Role</span><input value={roleDisplayName(user?.role)} disabled /><small>System Administrator lamang ang maaaring magtakda nito.</small></label>{user?.role === ROLES.KAGAWAD && <label><span>Assigned Committee</span><div className="profile-input-icon"><Landmark size={16} /><input value={user?.committeeName || (user?.committeeId ? `Committee ${user.committeeId}` : 'No committee assigned')} disabled /></div><small>Ito ang committee scope ng Dashboard, GIS, complaints, at reports.</small></label>}</div>
          <label><span>Email Address</span><div className="profile-input-icon"><Mail size={16} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label>

          <div className="profile-form-section-heading"><div><h3>Personal information</h3><p>Optional ang mga field na ito. Mananatiling blangko para sa bagong staff hanggang makumpleto nila ang profile.</p></div></div>
          <div className="profile-field-grid profile-personal-grid">
            <label><span>Gender</span><select value={gender} onChange={(event) => setGender(event.target.value)}><option value="">Pumili ng gender</option><option value="Lalaki">Lalaki</option><option value="Babae">Babae</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option></select></label>
            <label><span>Civil Status</span><select value={civilStatus} onChange={(event) => setCivilStatus(event.target.value)}><option value="">Pumili ng status</option><option value="Single">Single</option><option value="Married">Married</option><option value="Widowed">Widowed</option><option value="Separated">Separated</option></select></label>
            <label><span>Date of Birth</span><div className="profile-input-icon"><CalendarDays size={16} /><input type="date" max={new Date().toISOString().slice(0, 10)} value={birthdate} onChange={(event) => setBirthdate(event.target.value)} /></div></label>
            <label><span>Age</span><input value={ageFromBirthdate(birthdate)} placeholder="—" disabled /><small>Awtomatikong kinukuwenta mula sa date of birth.</small></label>
          </div>
          <label><span>Mobile Number</span><div className="profile-input-icon"><Phone size={16} /><input type="tel" inputMode="tel" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="Hal. 0917 123 4567" /></div></label>
          <label><span>Address</span><div className="profile-input-icon profile-textarea-icon"><MapPin size={16} /><textarea rows="3" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Ilagay ang kasalukuyang address" /></div></label>
          <div className="profile-form-actions"><button type="submit"><Save size={16} /> I-save ang Pagbabago</button></div>
        </div>
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
