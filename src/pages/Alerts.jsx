import './Alerts.css'
import { useState } from 'react'
import { Bell, Clock, Info, Search, Send, ShieldAlert, Trash2, Users } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { ROLES } from '../config/permissions'
import Pill from '../components/Pill'
import ConfirmDialog from '../components/ConfirmDialog'

const ALERT_LEVELS = ['Normal na Pagpapayo', 'Mataas na Alerto', 'Emergency']
const LEVEL_COLOR = { 'Normal na Pagpapayo': 'blue', 'Mataas na Alerto': 'orange', Emergency: 'red' }
const TYPE_COLOR = { 'Governance Notice': 'blue', 'Safety Advisory': 'orange', 'Community Announcement': 'green', 'Committee-scoped Advisory': 'blue', 'System-level Broadcast': 'gray' }
const CONFIGS_BY_ROLE = {
  [ROLES.SECRETARY]: { allowedTypes: ['Governance Notice', 'Safety Advisory', 'Community Announcement'], allowedTargets: ['Lahat ng Residente', 'Mga Kagawad', 'Lupon Members', 'Field Patrol Tanods Lamang'], canCompose: true },
  [ROLES.CAPTAIN]: { allowedTypes: ['Governance Notice', 'Safety Advisory', 'Community Announcement'], allowedTargets: ['Lahat ng Residente', 'Mga Kagawad', 'Lupon Members', 'Field Patrol Tanods Lamang'], canCompose: true },
  [ROLES.KAGAWAD]: { allowedTypes: ['Committee-scoped Advisory'], allowedTargets: ['Mga Kasapi ng Komite'], canCompose: true },
  [ROLES.ADMIN]: { allowedTypes: ['System-level Broadcast'], allowedTargets: ['System-wide Broadcast'], canCompose: true },
  [ROLES.TANOD]: { allowedTypes: [], allowedTargets: [], canCompose: false },
}

const FILTER_TYPES = ['Governance Notice', 'Safety Advisory', 'Community Announcement', 'Committee-scoped Advisory', 'System-level Broadcast']

export default function Alerts() {
  const { user } = useAuth()
  const { alertHistory, addAlert, deleteAlert, addAuditEntry } = useData()
  const { showToast } = useToast()
  const roleConfig = CONFIGS_BY_ROLE[user.role] || { allowedTypes: [], allowedTargets: [], canCompose: false }
  const canCompose = roleConfig.canCompose

  const [title, setTitle] = useState('')
  const [noticeType, setNoticeType] = useState(roleConfig.allowedTypes[0] || '')
  const [target, setTarget] = useState(roleConfig.allowedTargets[0] || '')
  const [level, setLevel] = useState(ALERT_LEVELS[0])
  const [message, setMessage] = useState('')
  const [confirmingSend, setConfirmingSend] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [alertToDelete, setAlertToDelete] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterLevel, setFilterLevel] = useState('All')

  function requestSubmit(event) {
    event.preventDefault()
    if (title.trim() && message.trim()) setConfirmingSend(true)
  }

  async function confirmSend() {
    const result = await addAlert({ title: title.trim(), type: noticeType, target, level, message: message.trim() })
    if (!result?.success) {
      showToast('Hindi naipadala ang abiso. Subukan muli.', 'error')
      setConfirmingSend(false)
      return
    }
    addAuditEntry(`Nagpadala ng ${noticeType} ("${title.trim()}") sa ${target}`, { color: 'blue' })
    showToast(`Naipadala ang abiso sa ${target}.`)
    setTitle('')
    setMessage('')
    setConfirmingSend(false)
  }

  async function confirmDelete() {
    if (!alertToDelete) return
    const selected = alertToDelete
    setConfirmingDelete(false)
    setAlertToDelete(null)
    const result = await deleteAlert(selected.id)
    if (result?.success) {
      addAuditEntry(`Binura ang abiso ("${selected.title || 'Abiso'}")`, { color: 'red' })
      showToast('Matagumpay na nabura ang abiso.')
    } else showToast('Hindi nabura ang abiso. Subukan muli.', 'error')
  }

  const roleHistory = alertHistory.filter((alert) => {
    if (user.role === ROLES.ADMIN) return alert.type === 'System-level Broadcast'
    if (user.role === ROLES.KAGAWAD) return alert.type === 'Committee-scoped Advisory'
    return true
  })
  const filteredHistory = roleHistory.filter((alert) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = !query || [alert.title, alert.message, alert.sentBy].some((value) => String(value || '').toLowerCase().includes(query))
    return matchesSearch && (filterType === 'All' || alert.type === filterType) && (filterLevel === 'All' || alert.level === filterLevel)
  })
  const metrics = [
    { value: 'All', label: 'Kabuuang naipadala', count: roleHistory.length, tone: 'blue', icon: Bell },
    { value: 'Mataas na Alerto', label: 'Mataas na alerto', count: roleHistory.filter((alert) => alert.level === 'Mataas na Alerto').length, tone: 'amber', icon: ShieldAlert },
    { value: 'Emergency', label: 'Kritikal / emergency', count: roleHistory.filter((alert) => alert.level === 'Emergency').length, tone: 'red', icon: ShieldAlert },
  ]
  const canDeleteAlert = [ROLES.SECRETARY, ROLES.CAPTAIN, ROLES.ADMIN, ROLES.KAGAWAD].includes(user.role)

  return <div className="alerts-page">
    <section className="alert-metric-grid" aria-label="Buod ng mga abiso">
      {metrics.map(({ value, label, count, tone, icon: Icon }) => <button type="button" key={value} onClick={() => setFilterLevel(value)} aria-pressed={filterLevel === value} className={`alert-metric tone-${tone} ${filterLevel === value ? 'is-active' : ''}`}><div><p>{label}</p><strong>{count}</strong></div><span><Icon size={20} /></span></button>)}
    </section>

    <div className={`alert-workspace ${canCompose ? 'has-composer' : ''}`}>
      {canCompose && <aside className="alert-compose-column">
        <form onSubmit={requestSubmit} className="alert-compose-panel">
          <header className="alert-compose-heading"><span><Send size={17} /></span><div><p>New broadcast</p><h2>Gumawa ng Abiso</h2><small>Ihanda ang mensahe bago ito i-dispatch.</small></div></header>

          <section className="alert-compose-stage">
            <div className="alert-stage-heading"><span>01</span><div><h3>Message identity</h3><p>Pamagat at uri ng opisyal na abiso.</p></div></div>
            <label><span>Pamagat ng abiso</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Maikling pamagat ng abiso" /></label>
            <label><span>Uri ng abiso</span><select value={noticeType} onChange={(event) => setNoticeType(event.target.value)} disabled={roleConfig.allowedTypes.length <= 1}>{roleConfig.allowedTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          </section>

          <section className="alert-compose-stage">
            <div className="alert-stage-heading"><span>02</span><div><h3>Audience & urgency</h3><p>Piliin ang tatanggap at antas ng alerto.</p></div></div>
            <label><span>Target audience</span><select value={target} onChange={(event) => setTarget(event.target.value)} disabled={roleConfig.allowedTargets.length <= 1}>{roleConfig.allowedTargets.map((audience) => <option key={audience}>{audience}</option>)}</select></label>
            <fieldset><legend>Antas ng alerto</legend><div className="alert-level-options">{ALERT_LEVELS.map((item) => <button type="button" key={item} onClick={() => setLevel(item)} aria-pressed={level === item} className={`tone-${LEVEL_COLOR[item]} ${level === item ? 'is-selected' : ''}`}><i />{item === 'Normal na Pagpapayo' ? 'Normal' : item === 'Mataas na Alerto' ? 'Mataas' : 'Emergency'}</button>)}</div></fieldset>
          </section>

          <section className="alert-compose-stage">
            <div className="alert-stage-heading"><span>03</span><div><h3>Notice body</h3><p>Isulat ang malinaw na tagubilin o anunsyo.</p></div></div>
            <label><span>Mensahe</span><textarea required rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ilagay ang kumpletong mensahe para sa mga residente..." /></label>
          </section>

          <button type="submit" className="alert-dispatch-button"><Send size={15} /> Review at i-dispatch</button>
        </form>

        <section className="alert-preview-panel">
          <header><div><p>Resident view</p><h3>Mobile notification preview</h3></div><span>Live</span></header>
          <div className={`alert-phone-card tone-${LEVEL_COLOR[level]}`}>
            <div className="alert-phone-app"><span><Bell size={12} /> BOSES BANTAY</span><time>now</time></div>
            <p className="alert-phone-type">{noticeType || 'Abiso'} <i /> {level}</p>
            <h4>{title || 'Pamagat ng Abiso'}</h4>
            <p className="alert-phone-message">{message || 'Dito lalabas ang nilalaman ng mensahe habang ginagawa mo ang abiso.'}</p>
            <footer><span>Para sa <strong>{target}</strong></span><span>Mula kay <strong>{user.name}</strong></span></footer>
          </div>
        </section>
      </aside>}

      <section className="alert-history-panel">
        <header className="alert-registry-heading">
          <div><p>Dispatch archive</p><h2>Mga Naipadalang Abiso <span>{filteredHistory.length} / {roleHistory.length}</span></h2></div>
          <div className="alert-registry-tools">
            <label className="alert-search"><Search size={14} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Hanapin ang abiso..." /></label>
            <select value={filterType} onChange={(event) => setFilterType(event.target.value)} aria-label="I-filter ayon sa uri"><option value="All">Lahat ng uri</option>{FILTER_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            <select value={filterLevel} onChange={(event) => setFilterLevel(event.target.value)} aria-label="I-filter ayon sa antas"><option value="All">Lahat ng antas</option>{ALERT_LEVELS.map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </header>

        <div className="alert-dispatch-list max-h-[calc(100vh-260px)] overflow-y-auto">
          {!filteredHistory.length && <div className="alert-empty-state"><Info size={24} /><h3>Walang natagpuang abiso</h3><p>Subukan ang ibang search term o filter.</p></div>}
          {filteredHistory.map((alert) => <article key={alert.id} className={`alert-dispatch-card tone-${LEVEL_COLOR[alert.level] || 'blue'}`}>
            <div className="alert-dispatch-main">
              <span className="alert-dispatch-icon"><Bell size={18} /></span>
              <div className="alert-dispatch-copy"><div className="alert-dispatch-badges"><Pill color={TYPE_COLOR[alert.type] || 'gray'} solid={false}>{alert.type}</Pill><Pill color={LEVEL_COLOR[alert.level] || 'gray'}>{alert.level}</Pill></div><h3>{alert.title}</h3><p>{alert.message}</p></div>
            </div>
            <footer className="alert-dispatch-footer"><div><span><Users size={12} /> {alert.target}</span><span><Clock size={12} /> {alert.sentAt}</span><span>Ni <strong>{alert.sentBy}</strong></span></div>{canDeleteAlert && <button type="button" onClick={() => { setAlertToDelete(alert); setConfirmingDelete(true) }} aria-label="Burahin ang abiso" title="Burahin ang abiso"><Trash2 size={14} /></button>}</footer>
          </article>)}
        </div>
      </section>
    </div>

    {!canCompose && <div className="alert-readonly-note"><Info size={17} /><p><strong>Read-only access.</strong> Naka-log in ka bilang {user.role}. Maaari mong basahin ang mga abiso ngunit hindi gumawa ng bago.</p></div>}

    <ConfirmDialog open={confirmingSend} onClose={() => setConfirmingSend(false)} onConfirm={confirmSend} title="I-dispatch ang Abiso?" message={`Ipapadala ang abisong "${title}" sa ${target}. Hindi na ito mababawi kapag naipadala na.`} confirmLabel="Ipadala" danger={level === 'Emergency'} />
    <ConfirmDialog open={confirmingDelete} onClose={() => { setConfirmingDelete(false); setAlertToDelete(null) }} onConfirm={confirmDelete} title="Burahin ang Abiso?" message={alertToDelete?.title ? `Sigurado ka bang nais mong burahin ang abisong "${alertToDelete.title}"? Permanenteng mawawala ito sa talaan.` : 'Sigurado ka bang nais mong burahin ang abisong ito?'} confirmLabel="Burahin" danger />
  </div>
}
