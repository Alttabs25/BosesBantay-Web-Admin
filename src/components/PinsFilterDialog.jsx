import { useRef, useState } from 'react'
import Modal from './Modal'
import { ALL_CLASSIFICATIONS, SEVERITY_FILTERS, SEVERITY_META, TIME_INTERVALS, UNRECORDED_SEVERITY } from '../data/mockIncidents'

const PIN_SEVERITY_FILTERS = [...SEVERITY_FILTERS, UNRECORDED_SEVERITY]
const matchesSeverity = (incident, level) => level === SEVERITY_FILTERS[0]
  || (level === UNRECORDED_SEVERITY ? !SEVERITY_META[incident.severity] : incident.severity === level)

export default function PinsFilterDialog({ open, onClose, severity, onSeverity, classification, onClassification, dateRange, onDateRange, dateRanges, interval, onInterval, candidates, classifications, count, onReset }) {
  const [query, setQuery] = useState('')
  const typeListRef = useRef(null)
  const types = [...new Set([...classifications, ...(classification !== ALL_CLASSIFICATIONS ? [classification] : [])])].filter(type => type.toLowerCase().includes(query.trim().toLowerCase()))
  const scrollTypes = event => {
    if (event.target.closest('.gis-type-choices')) return
    const list = typeListRef.current
    if (!list || list.scrollHeight <= list.clientHeight) return
    list.scrollTop += event.deltaY
    event.preventDefault()
  }
  return <Modal open={open} onClose={onClose} title="Filter pins" maxWidth="max-w-2xl">
    <div id="gis-filters" className="gis-workspace gis-filter-popup" role="dialog" aria-modal="true" aria-label="Filter pins"><div className="gis-analysis-panel"><div id="gis-overview-filters"><div className="gis-analysis-controls">
      <div className="gis-date-filter"><label><span>Date range</span><select value={dateRange} onChange={event => onDateRange(event.target.value)}>{dateRanges.map((range,index) => <option key={range} value={range}>{['All dates','Last 7 days','Last 30 days'][index]}</option>)}</select></label><label className="gis-pins-time"><span>Time of day</span><select value={interval} onChange={event => onInterval(event.target.value)}>{TIME_INTERVALS.map(time => <option key={time}>{time}</option>)}</select></label></div>
      <fieldset className="gis-multi-filter gis-severity-picker"><legend><span>Severity</span></legend>{PIN_SEVERITY_FILTERS.map(level => {
        const matches = candidates.filter(i => matchesSeverity(i, level) && (classification === ALL_CLASSIFICATIONS || i.classification === classification)).length
        const label = level === UNRECORDED_SEVERITY ? 'Not recorded' : SEVERITY_META[level]?.label || 'All levels'
        return <label key={level}><input type="radio" name="pins-severity" checked={severity === level} disabled={!matches && severity !== level && level !== SEVERITY_FILTERS[0]} onChange={() => onSeverity(level)} /><span>{label}</span><small>{matches}</small></label>
      })}</fieldset>
      <fieldset className="gis-multi-filter gis-type-select" onWheel={scrollTypes}><legend><span>Incident type</span></legend><div className="gis-type-search-row"><input type="search" aria-label="Search incident types" placeholder="Search types" value={query} onChange={event => setQuery(event.target.value)} /></div><div ref={typeListRef} className="gis-type-choices"><label><input type="radio" name="pins-type" checked={classification === ALL_CLASSIFICATIONS} onChange={() => onClassification(ALL_CLASSIFICATIONS)} /><span>All types</span></label>{types.map(type => <label key={type}><input type="radio" name="pins-type" checked={classification === type} onChange={() => onClassification(type)} /><span>{type}</span><small>{candidates.filter(i => i.classification === type && matchesSeverity(i, severity)).length}</small></label>)}{!types.length && <p className="gis-type-empty">No matching types.</p>}</div></fieldset>
    </div><div className="gis-filter-footer"><button className="gis-filter-reset" type="button" onClick={() => { onReset(); setQuery('') }}>Clear filters</button><button className="gis-show-results" type="button" onClick={onClose}>View {count} results</button></div></div></div></div>
  </Modal>
}
