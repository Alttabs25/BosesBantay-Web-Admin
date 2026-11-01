import FilterPopup from '../components/FilterPopup'
import Modal from '../components/Modal'
import './AuditLogs.css'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowDownUp, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Search, X } from 'lucide-react'
import { useData } from '../context/DataContext'

const PAGE_SIZE = 15
const ALL_FILTERS = { from: '', to: '', actor: '', action: '', severity: '' }

function activityArea(action = '') {
  const value = String(action).toLowerCase()
  if (/blotter/.test(value)) return 'Blotter reports'
  if (/service complaint|complaint|reklamo/.test(value)) return 'Service complaints'
  if (/gis|\bpin\b|map|insidente|incident/.test(value)) return 'GIS & incidents'
  if (/chatbot|document|knowledge|source|index/.test(value)) return 'Knowledge base'
  if (/account|user|password|role|2fa|login|logout|access/.test(value)) return 'Accounts & access'
  if (/notification|abiso|alert/.test(value)) return 'Notifications'
  if (/contact|directory|hotline/.test(value)) return 'Directory'
  if (/report|export|summary/.test(value)) return 'Reports'
  return 'Admin activity'
}
function eventKind(actionType = '') {
  const value = String(actionType).toLowerCase()
  if (/^login_failure|^login_2fa_failure/.test(value)) return 'Failed sign-in attempt'
  if (/^login_service_error/.test(value)) return 'Sign-in service error'
  if (/^restrict|suspend|block|spam/.test(value)) return 'Access restriction'
  if (/^publish|^unpublish/.test(value)) return 'Publication change'
  if (/^activate|^archive|^index/.test(value)) return 'Knowledge source change'
  if (/^report/.test(value)) return 'Report activity'
  if (/^map/.test(value)) return 'Map change'
  if (/^export/.test(value)) return 'Data export'
  if (/delete|remove|hapus|tinanggal|binura/.test(value)) return 'Deletion'
  if (/create|add|insert|dagdag|nagdagdag|lumikha|upload/.test(value)) return 'Creation'
  if (/login|logout|password|2fa|auth|access/.test(value)) return 'Access event'
  if (/approve|resolve|complete|success|apruba|resolved/.test(value)) return 'Approval / completion'
  if (/update|edit|change|status|in-update|binago|in-edit/.test(value)) return 'Update'
  return 'Administrative action'
}
function severityFor(value = '') {
  const normalized = ({ info: 'normal', success: 'normal', blue: 'normal', green: 'normal' })[value] || value
  const severity = normalized === 'warning' || normalized === 'critical' ? normalized : 'normal'
  if (severity === 'critical') return { label: 'Critical', key: 'critical', Icon: AlertTriangle }
  if (severity === 'warning') return { label: 'Warning', key: 'warning', Icon: AlertTriangle }
  return { label: 'Normal', key: 'normal', Icon: CheckCircle2 }
}
function targetLabel(table) {
  const labels = { users: 'User account', incidents: 'Incident', reports: 'Report', blotter_reports: 'Blotter report', service_complaints: 'Service complaint', documents: 'Document', emergency_contacts: 'Emergency contact', notifications: 'Notification', audit_logs: 'Audit log', login_logs: 'Login event', role_module_access: 'Role access' }
  return labels[String(table || '').toLowerCase()] || (table ? String(table).replaceAll('_', ' ') : '')
}
function recordReference(action = '') { return String(action).match(/\b(?:BGY|SC|REF|BLT)-[A-Z0-9-]+\b/i)?.[0] || '' }
function exactTime(log) {
  const date = new Date(log.createdAt)
  if (Number.isNaN(date.getTime())) return log.timestamp || 'Time unavailable'
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function relativeTime(log) {
  const time = new Date(log.createdAt).getTime()
  if (!Number.isFinite(time)) return log.timestamp || 'Time unavailable'
  const seconds = Math.round((time - Date.now()) / 1000)
  const divisions = [['year',31536000],['month',2592000],['week',604800],['day',86400],['hour',3600],['minute',60]]
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit,size] of divisions) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  return rtf.format(seconds, 'second')
}
function exportRows(logs) {
  return logs.map(log => ({ audit_id:log.id, timestamp:log.createdAt, actor:log.actorName, actor_role:log.actorRole, actor_id:log.actorId, action_type:log.actionType, action:log.action, target_table:log.targetTable || null, target_id:log.targetId, target_key:log.targetKey||null, severity:severityFor(log.severity).label, source:log.source||'Not recorded', ip_address:log.ipAddress||'Not captured', metadata:log.metadata||{} }))
}
function changeValue(value) {
  return value == null ? 'Not captured for this event' : JSON.stringify(value, null, 2)
}
function outcomeLabel(value) {
  return ({ success: 'Succeeded', failure: 'Failed', denied: 'Denied', partial: 'Partially completed' })[value] || value || 'Recorded'
}
function downloadJson(logs) {
  const blob = new Blob([JSON.stringify(exportRows(logs), null, 2)], { type:'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href=url; link.download=`audit-logs-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url)
}
function downloadCsv(logs) {
  const rows = [['Audit ID','Timestamp','Actor','Role','Actor ID','Action type','Action','Target table','Target ID','Target key','Severity','Source','IP address','Metadata'], ...exportRows(logs).map(row=>[row.audit_id,row.timestamp,row.actor,row.actor_role,row.actor_id,row.action_type,row.action,row.target_table,row.target_id,row.target_key,row.severity,row.source,row.ip_address,JSON.stringify(row.metadata)])]
  const csv = rows.map(row=>row.map(value=>`"${String(value ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' }); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`audit-logs-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url)
}

export default function AuditLogs() {
  const { auditLog } = useData()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(ALL_FILTERS)
  const [sort, setSort] = useState({ key:'createdAt', direction:'desc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const users = useMemo(()=>[...new Set(auditLog.map(log=>log.actorName).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),[auditLog])
  const actions = useMemo(()=>[...new Set(auditLog.map(log=>eventKind(log.actionType)))].sort(),[auditLog])
  const filtered = useMemo(()=>{
    const search=query.trim().toLowerCase()
    return auditLog.filter(log=>{
      const time=new Date(log.createdAt).getTime()
      const matchesSearch=!search||[log.id,log.actorName,log.actorRole,log.actorId,log.action,log.actionType,log.targetTable,log.targetId,log.targetKey,log.source,activityArea(log.action),recordReference(log.action)].some(value=>String(value??'').toLowerCase().includes(search))
      const matchesFrom=!filters.from||(!Number.isNaN(time)&&time>=new Date(`${filters.from}T00:00:00`).getTime())
      const matchesTo=!filters.to||(!Number.isNaN(time)&&time<=new Date(`${filters.to}T23:59:59.999`).getTime())
      const matchesActor=!filters.actor||log.actorName===filters.actor
      const matchesAction=!filters.action||eventKind(log.actionType)===filters.action
      const severity=severityFor(log.severity).key
      const matchesSeverity=!filters.severity||(filters.severity==='attention'?['warning','critical'].includes(severity):severity===filters.severity)
      return matchesSearch&&matchesFrom&&matchesTo&&matchesActor&&matchesAction&&matchesSeverity
    })
  },[auditLog,query,filters])
  const sorted=useMemo(()=>[...filtered].sort((a,b)=>{
    let av=a[sort.key], bv=b[sort.key]
    if(sort.key==='actor') { av=a.actorName; bv=b.actorName }
    if(sort.key==='action') { av=a.action; bv=b.action }
    if(sort.key==='target') { av=`${a.targetTable}${a.targetKey}${a.targetId}`; bv=`${b.targetTable}${b.targetKey}${b.targetId}` }
    if(sort.key==='severity') { av=severityFor(a.severity).label; bv=severityFor(b.severity).label }
    if(sort.key==='createdAt') { av=new Date(a.createdAt).getTime(); bv=new Date(b.createdAt).getTime() }
    const compare=typeof av==='number'&&typeof bv==='number'?av-bv:String(av||'').localeCompare(String(bv||''),undefined,{numeric:true,sensitivity:'base'})
    return compare*(sort.direction==='asc'?1:-1)
  }),[filtered,sort])
  useEffect(()=>{setCurrentPage(1)},[query,filters,sort])
  const totalPages=Math.max(1,Math.ceil(sorted.length/PAGE_SIZE))
  const pageRows=sorted.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE)
  const selectedLog=pageRows.find(log=>log.id===expandedId)||sorted.find(log=>log.id===expandedId)||null
  const selectedSeverity=selectedLog?severityFor(selectedLog.severity):null
  const SelectedSeverityIcon=selectedSeverity?.Icon
  const startEntry=sorted.length?(currentPage-1)*PAGE_SIZE+1:0
  const endEntry=Math.min(currentPage*PAGE_SIZE,sorted.length)
  const attentionCount=auditLog.filter(log=>['critical','warning'].includes(severityFor(log.severity).key)).length
  const normalCount=auditLog.filter(log=>severityFor(log.severity).key==='normal').length
  const actorCount=new Set(auditLog.map(log=>log.actorName).filter(Boolean)).size
  const metrics=[{value:'all',label:'All events',count:auditLog.length,tone:'blue'},{value:'attention',label:'Needs review',count:attentionCount,tone:'orange'},{value:'normal',label:'Normal activity',count:normalCount,tone:'green'}]
  const activeFilters=Object.entries(filters).filter(([,value])=>value)
  function setFilter(key,value){setFilters(previous=>({...previous,[key]:value}))}
  function toggleSort(key){setSort(previous=>previous.key===key?{key,direction:previous.direction==='asc'?'desc':'asc'}:{key,direction:key==='createdAt'?'desc':'asc'})}
  function sortButton(key,label){const Icon=sort.key===key?(sort.direction==='asc'?ArrowUp:ArrowDown):ArrowDownUp;return <button type="button" className="audit-sort" onClick={()=>toggleSort(key)}>{label}<Icon size={12}/></button>}
  function visiblePages(){const start=Math.max(1,Math.min(currentPage-2,totalPages-4));return Array.from({length:Math.min(5,totalPages)},(_,index)=>start+index)}
  function removeFilter(key){setFilter(key,'')}
  function filterLabel(key,value){return key==='from'?`From ${value}`:key==='to'?`To ${value}`:key==='actor'?`User: ${value}`:key==='action'?`Action: ${value}`:`Severity: ${value==='attention'?'Warning + critical':severityFor(value).label}`}

  return <div className="audit-page">
    <section className="audit-metric-grid" aria-label="Audit log summary">
      {metrics.map(({value,label,count,tone})=><button type="button" key={value} onClick={()=>setFilter('severity',value==='all'?'':value==='attention'?'attention':value)} aria-pressed={(value==='all'&&!filters.severity)||(value==='attention'&&filters.severity==='attention')||(value==='normal'&&filters.severity==='normal')} className={`audit-metric tone-${tone}`}><span className="audit-metric-label"><i aria-hidden="true" />{label}</span><strong>{count}</strong></button>)}
      <div className="audit-metric tone-slate"><span className="audit-metric-label"><i aria-hidden="true" />Unique users</span><strong>{actorCount}</strong></div>
    </section>

    <section className="audit-registry">
      <header className="audit-registry-heading">
        <div className="audit-registry-title"><h2>Audit events</h2></div>
        <div className="audit-registry-tools">
          <label className="audit-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search actor, event, target, or ID" aria-label="Search audit events"/></label>
          <FilterPopup title="Filter audit events" resultNoun="events" count={sorted.length} activeCount={activeFilters.length} onReset={()=>setFilters(ALL_FILTERS)} description="Narrow the audit trail by date, user, action, or severity.">
            <label><span>From date</span><input type="date" value={filters.from} onChange={event=>setFilter('from',event.target.value)}/></label>
            <label><span>To date</span><input type="date" value={filters.to} onChange={event=>setFilter('to',event.target.value)}/></label>
            <label><span>User / actor</span><select value={filters.actor} onChange={event=>setFilter('actor',event.target.value)}><option value="">All users</option>{users.map(user=><option key={user} value={user}>{user}</option>)}</select></label>
            <label><span>Action type</span><select value={filters.action} onChange={event=>setFilter('action',event.target.value)}><option value="">All actions</option>{actions.map(action=><option key={action} value={action}>{action}</option>)}</select></label>
            <label><span>Severity</span><select value={filters.severity} onChange={event=>setFilter('severity',event.target.value)}><option value="">All levels</option><option value="normal">Normal</option><option value="warning">Warning</option><option value="critical">Critical</option><option value="attention">Warning + critical</option></select></label>
          </FilterPopup>
          <div className="audit-export" role="group" aria-label="Export audit events"><span className="audit-export-label">Export</span><button type="button" title="Download audit events as CSV" onClick={()=>downloadCsv(sorted)} disabled={!sorted.length}>CSV</button><button type="button" title="Download audit events as JSON" onClick={()=>downloadJson(sorted)} disabled={!sorted.length}>JSON</button></div>
        </div>
      </header>
      {activeFilters.length>0&&<div className="audit-filter-chips" aria-label="Active filters">{activeFilters.map(([key,value])=><button type="button" key={key} onClick={()=>removeFilter(key)}>{filterLabel(key,value)}<X size={13}/></button>)}<button type="button" className="audit-clear-chips" onClick={()=>setFilters(ALL_FILTERS)}>Clear all</button></div>}

      <div className="audit-table-scroll"><table className="audit-table"><thead><tr><th>{sortButton('id','Log ID')}</th><th>{sortButton('createdAt','Time')}</th><th>{sortButton('actor','Actor')}</th><th>{sortButton('action','Action')}</th><th>{sortButton('target','Record')}</th><th>{sortButton('severity','Severity')}</th><th>Source · IP</th><th>Details</th></tr></thead><tbody>
        {!pageRows.length&&<tr><td colSpan="8"><div className="audit-empty-state"><Search size={25}/><h3>No audit events found</h3><p>Change or clear your search and filters.</p></div></td></tr>}
        {pageRows.map(log=>{const severity=severityFor(log.severity);const Icon=severity.Icon;const reference=log.targetKey||recordReference(log.action);const target=log.targetTable?targetLabel(log.targetTable):reference?'Record':'Not recorded';return <tr key={log.id} className={`audit-row severity-${severity.key}`}>
            <td><code className="audit-row-id">#{log.id}</code></td>
            <td><time className="audit-time" dateTime={log.createdAt||undefined} title={`Exact time: ${exactTime(log)}`}><span>{exactTime(log)}</span><small>{relativeTime(log)}</small></time></td>
            <td><div className="audit-user"><span><strong>{log.actorName||'System'}</strong><small>{log.actorRole||'Role unavailable'}</small></span></div></td>
            <td><div className="audit-action"><div className="audit-action-context"><span>{eventKind(log.actionType)}</span>{log.metadata?.outcome&&<b className={`audit-outcome outcome-${String(log.metadata.outcome).toLowerCase().replace(/\s+/g,'-')}`}>{outcomeLabel(log.metadata.outcome)}</b>}</div><strong title={log.action||log.actionType||'Action not recorded'}>{log.action||log.actionType||'Action not recorded'}</strong></div></td>
            <td><div className="audit-resource"><span>{target}</span>{reference&&<code>{reference}</code>}{!reference&&log.targetId!=null&&<code>ID {log.targetId}</code>}</div></td>
            <td><span className={`audit-severity severity-${severity.key}`}><Icon size={13}/>{severity.label}</span></td>
            <td><div className="audit-origin"><span className="audit-source-value" title={log.source||'Not recorded'}>{(log.source||'Not recorded').replace(/^web-admin:/,'').replaceAll('-',' ')}</span><small className="audit-ip-unavailable">{log.ipAddress||'IP not captured'}</small></div></td>
            <td><button type="button" className="audit-details-toggle" aria-label={`Open details for log ${log.id}`} title="Open event details" onClick={()=>setExpandedId(log.id)}><span>View</span><ChevronRight size={15}/></button></td>
          </tr>})}
      </tbody></table></div>
      {sorted.length>0&&<footer className="audit-pagination"><p>Showing <strong>{startEntry}–{endEntry}</strong> of <strong>{sorted.length}</strong> filtered events</p><nav aria-label="Audit log pages"><button type="button" onClick={()=>setCurrentPage(page=>Math.max(page-1,1))} disabled={currentPage===1} aria-label="Previous page"><ChevronLeft size={16}/></button>{visiblePages().map(page=><button type="button" key={page} onClick={()=>setCurrentPage(page)} aria-current={currentPage===page?'page':undefined} className={currentPage===page?'is-current':''}>{page}</button>)}<button type="button" onClick={()=>setCurrentPage(page=>Math.min(page+1,totalPages))} disabled={currentPage===totalPages} aria-label="Next page"><ChevronRight size={16}/></button></nav></footer>}
      <p className="audit-schema-note"><Clock3 size={13}/> Normal = authorized activity · Warning = failed sign-in or service issue · Critical = 5+ failed sign-ins from one IP in 10 minutes. IP is recorded from Supabase request headers where available.</p>
    </section>
    <Modal open={Boolean(selectedLog)} onClose={()=>setExpandedId(null)} title="Audit event details" maxWidth="max-w-5xl">
          {selectedLog&&<div className="audit-detail-panel"><header className={`audit-detail-hero severity-${selectedSeverity.key}`}><div><span className="audit-detail-id">LOG #{selectedLog.id}</span><h2>{selectedLog.action||selectedLog.actionType||'Action not recorded'}</h2><p>{eventKind(selectedLog.actionType)} <span>·</span> {activityArea(selectedLog.action)}</p></div><span className={`audit-severity severity-${selectedSeverity.key}`}><SelectedSeverityIcon size={15}/>{selectedSeverity.label}</span></header><div className="audit-detail-columns"><section className="audit-detail-section"><div className="audit-detail-section-heading"><span>01</span><h3>Event information</h3></div><dl><div><dt>Performed by</dt><dd>{selectedLog.actorName||'System'} <small>{selectedLog.actorRole||'Role unavailable'}</small></dd></div><div><dt>Timestamp</dt><dd>{exactTime(selectedLog)}</dd></div><div><dt>Record reference</dt><dd>{selectedLog.targetTable?`${targetLabel(selectedLog.targetTable)}${selectedLog.targetId!=null?` · ID ${selectedLog.targetId}`:''}`:selectedLog.targetKey||recordReference(selectedLog.action)||'Not recorded'}{selectedLog.targetTable&&selectedLog.targetKey&&<small>{selectedLog.targetKey}</small>}</dd></div><div><dt>Result</dt><dd>{outcomeLabel(selectedLog.metadata?.outcome)}{selectedLog.metadata?.failed_attempts_last_10m>1&&<small>{selectedLog.metadata.failed_attempts_last_10m} failed sign-in attempts from this IP in 10 minutes</small>}</dd></div><div><dt>Actor ID</dt><dd><code>{selectedLog.actorId||'Not recorded'}</code></dd></div><div><dt>Source</dt><dd>{selectedLog.source||'Not recorded'}</dd></div><div><dt>IP address</dt><dd>{selectedLog.ipAddress||'Not captured'}</dd></div></dl><div className="audit-change-values"><div><h4>Before</h4><pre>{changeValue(selectedLog.metadata?.before)}</pre></div><div><h4>After</h4><pre>{changeValue(selectedLog.metadata?.after)}</pre></div></div></section><section className="audit-raw"><div className="audit-detail-section-heading"><span>02</span><div><h3>Stored event data</h3><p>Original audit fields and action context</p></div></div><pre>{JSON.stringify(selectedLog.rawEvent||{audit_id:selectedLog.id,details:selectedLog.action,created_at:selectedLog.createdAt},null,2)}</pre></section></div></div>}
    </Modal>
  </div>
}
