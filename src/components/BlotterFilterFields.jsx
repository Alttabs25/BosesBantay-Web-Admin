const PROGRESS = [
  ['all', 'All reports'], ['pending', 'Under review'], ['active', 'In progress'], ['closed', 'Closed'],
]
const ATTENTION = [
  ['needs_schedule', 'Needs hearing schedule'], ['scheduled', 'Hearing scheduled'],
  ['needs_outcome', 'Awaiting final outcome'], ['escalated', 'Escalated'],
]

export default function BlotterFilterFields({ variant = 'blotter', status, onStatus, counts, total, category, onCategory, categories, dateRange, onDateRange, sort, onSort }) {
  const choices = (items, heading) => <fieldset><legend>{heading}</legend><div className="blotter-filter-options">{items.map(([value,label]) => {
    const count = value === 'all' ? total : counts[value] || 0
    return <label key={value}><input type="radio" name="blotter-show" checked={status === value} disabled={!count && value !== 'all' && status !== value} onChange={() => onStatus(value)} /><span>{label}</span><small>{count}</small></label>
  })}</div></fieldset>
  return <div className="blotter-filter-layout">
    <div className="blotter-filter-progress">
      {choices(variant === 'complaint' ? [['all','All complaints'],['pending','Under review'],['active','In progress'],['closed','Completed / closed']] : PROGRESS, variant === 'complaint' ? 'Complaint status' : 'Report status')}
      {choices([...(variant === 'complaint' ? [['spam','Spam'],['out_of_scope','Out of scope']] : ATTENTION), ...(counts.other ? [['other','Other status']] : [])], variant === 'complaint' ? 'Other classifications' : 'Hearing & follow-up')}
    </div>
    <div className="blotter-filter-scope">
      <label><span>{variant === 'complaint' ? 'Complaint category' : 'Incident category'}</span><select value={category} onChange={event => onCategory(event.target.value)}><option value="all">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      <label><span>Date submitted</span><select value={dateRange} onChange={event => onDateRange(event.target.value)}><option value="all">All dates</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label className="blotter-filter-sort"><span>Order</span><select value={sort} onChange={event => onSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div>
  </div>
}
