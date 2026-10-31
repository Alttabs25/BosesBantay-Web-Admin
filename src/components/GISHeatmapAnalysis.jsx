import { useState } from 'react'
import Modal from './Modal'
import { ALL_CLASSIFICATIONS, SEVERITY_FILTERS, SEVERITY_META, TIME_INTERVALS } from '../data/mockIncidents'

export default function GISHeatmapAnalysis({ incidents, filtersOpen, onFiltersOpen, selectedSeverities, selectedTypes, onSelectedSeverities, onSelectedTypes, typeColors, colorMode, onColorMode, total, severity, classification, onClassification, dateRange, interval, onInterval, onDateRange, dateRanges, onSeverity, onClear, query, onQuery, severityCounts, dateCounts, typeCounts }) {
  const [section, setSection] = useState('types')
  const [typeQuery, setTypeQuery] = useState('')
  const filterCount = [dateRange !== dateRanges[0], selectedSeverities.length > 0, selectedTypes.length > 0, interval !== TIME_INTERVALS[0], Boolean(query)].filter(Boolean).length
  const categories = Object.entries(incidents.reduce((counts, incident) => {
    const key = incident.classification || 'Not classified'
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const periods = TIME_INTERVALS.slice(1).map((label, index) => ({ label, count: incidents.filter(incident => {
    const date = new Date(incident.dateISO)
    if (Number.isNaN(date.getTime())) return false
    return Math.floor(date.getHours() / 6) === [1, 2, 3, 0][index]
  }).length }))
  const unknownSeverity = incidents.filter(incident => !SEVERITY_META[incident.severity]).length
  const unknownTime = incidents.filter(incident => !incident.dateISO || Number.isNaN(new Date(incident.dateISO).getTime())).length
  const percent = count => incidents.length ? Math.round(count / incidents.length * 100) : 0
  return <aside className="gis-analysis-panel" aria-label="Heatmap analysis">
    <header className="gis-overview-header"><div><h3>Overview</h3><p><strong>{incidents.length}</strong> incidents<span className="gis-overview-total"> / {total} total</span></p></div></header>
    <div className="gis-color-mode"><span>Color by</span><div role="group" aria-label="Heatmap color mode">{[['type', 'Incident type'], ['severity', 'Severity']].map(([mode,label]) => <button type="button" key={mode} aria-pressed={colorMode === mode} onClick={() => onColorMode(mode)}>{label}</button>)}</div></div>
    <Modal open={filtersOpen} onClose={() => onFiltersOpen(false)} title="Filter heatmap" maxWidth="max-w-2xl">
    <div className="gis-workspace gis-filter-popup" role="dialog" aria-modal="true" aria-label="Heatmap filters"><div className="gis-analysis-panel">
    <div id="gis-overview-filters"><div className="gis-analysis-controls">
      <label className="gis-date-filter"><span>Date range</span><select value={dateRange} onChange={event => onDateRange(event.target.value)}>{dateRanges.map(range => <option key={range} value={range} disabled={dateCounts[range] === 0 && dateRange !== range}>{range === dateRanges[0] ? 'All dates' : range === dateRanges[1] ? 'Last 7 days' : 'Last 30 days'}{dateCounts[range] === 0 ? ' (0)' : ''}</option>)}</select></label>
      <fieldset className="gis-multi-filter gis-severity-picker"><legend><span>Severity</span><small>{selectedSeverities.length ? `${selectedSeverities.length} selected` : 'All levels'}</small></legend>{selectedSeverities.length > 0 && <button className="gis-group-clear" type="button" onClick={() => onSelectedSeverities([])}>Clear selection</button>}{SEVERITY_FILTERS.slice(1).map(level => <label key={level}><input type="checkbox" checked={selectedSeverities.includes(level)} disabled={!severityCounts[level] && !selectedSeverities.includes(level)} onChange={() => onSelectedSeverities(selectedSeverities.includes(level) ? selectedSeverities.filter(value => value !== level) : [...selectedSeverities, level])} /><i style={{ background: SEVERITY_META[level].color }} /><span>{SEVERITY_META[level].label}</span><small>{severityCounts[level]}</small></label>)}</fieldset>
      <fieldset className="gis-multi-filter gis-type-select"><legend><span>Incident types</span><small>{selectedTypes.length ? `${selectedTypes.length} selected` : 'All types'}</small></legend><div className="gis-type-search-row"><input type="search" aria-label="Find incident types" placeholder="Search types" value={typeQuery} onChange={event => setTypeQuery(event.target.value)} />{selectedTypes.length > 0 && <button className="gis-group-clear" type="button" onClick={() => onSelectedTypes([])}>Clear</button>}</div><div className="gis-type-choices">{[...new Set([...typeCounts.map(([type]) => type), ...selectedTypes])].filter(type => type.toLocaleLowerCase().includes(typeQuery.trim().toLocaleLowerCase())).map(type => { const count = typeCounts.find(([label]) => label === type)?.[1] || 0; return <label key={type}><input type="checkbox" checked={selectedTypes.includes(type)} disabled={!count && !selectedTypes.includes(type)} onChange={() => onSelectedTypes(selectedTypes.includes(type) ? selectedTypes.filter(value => value !== type) : [...selectedTypes,type])} /><i style={{ background: typeColors[type] }} /><span>{type}</span><small>{count || 'No records'}</small></label> })}{![...new Set([...typeCounts.map(([type]) => type), ...selectedTypes])].some(type => type.toLocaleLowerCase().includes(typeQuery.trim().toLocaleLowerCase())) && <p className="gis-type-empty">{typeQuery ? 'No matching incident types.' : 'No types available for these filters.'}</p>}</div></fieldset>
    </div>
    <div className="gis-filter-footer">
      <button className="gis-filter-reset" type="button" disabled={filterCount === 0} onClick={() => { onClear(); setTypeQuery('') }}>Clear filters</button>
      <button className="gis-show-results" type="button" onClick={() => onFiltersOpen(false)}>View {incidents.length} results</button>
    </div>
    </div>
    </div></div>
    </Modal>
    {(selectedTypes.length > 0 || selectedSeverities.length > 0 || interval !== TIME_INTERVALS[0] || dateRange !== dateRanges[0] || severity !== SEVERITY_FILTERS[0] || query) && <div className="gis-analysis-active">
      {selectedSeverities.map(level => <button type="button" key={level} onClick={() => onSelectedSeverities(selectedSeverities.filter(value => value !== level))}>{SEVERITY_META[level].label} ×</button>)}
      {selectedTypes.map(type => <button type="button" key={type} onClick={() => onSelectedTypes(selectedTypes.filter(value => value !== type))}>{type} ×</button>)}
      {interval !== TIME_INTERVALS[0] && <button type="button" onClick={() => onInterval(TIME_INTERVALS[0])} aria-label="Remove time filter">{interval} ×</button>}
      {query && <button type="button" onClick={() => onQuery('')} aria-label="Remove search filter">Search: {query} ×</button>}

    </div>}

    <div className="gis-overview-results">
    <div className="gis-insight-tabs" role="tablist" aria-label="Analysis breakdown">
      {[['types', 'Types'], ['time', 'Time'], ['severity', 'Severity']].map(([key, label]) => <button type="button" key={key} role="tab" id={`gis-analysis-tab-${key}`} aria-controls={`gis-analysis-content-${key}`} aria-selected={section === key} onClick={() => setSection(key)} onKeyDown={event => {
        const keys = ['types', 'time', 'severity']
        let next
        if (event.key === 'ArrowRight') next = keys[(keys.indexOf(section) + 1) % keys.length]
        if (event.key === 'ArrowLeft') next = keys[(keys.indexOf(section) + 2) % keys.length]
        if (event.key === 'Home') next = keys[0]
        if (event.key === 'End') next = keys[2]
        if (next) { event.preventDefault(); setSection(next); document.getElementById(`gis-analysis-tab-${next}`)?.focus() }
      }} tabIndex={section === key ? 0 : -1}>{label}</button>)}
    </div>
    <div role="tabpanel" id={`gis-analysis-content-${section}`} aria-labelledby={`gis-analysis-tab-${section}`}>
    {!incidents.length ? <div className="gis-analysis-empty"><h4>No incidents match these filters</h4><p>Try a wider date range or another severity.</p></div> : <>
      {section === 'severity' && <section><h4>Severity breakdown</h4><div className="gis-analysis-severities">{SEVERITY_FILTERS.slice(1).map(level => {
        const count = incidents.filter(incident => incident.severity === level).length
        return <div className={`gis-severity-stat ${count === 0 ? 'gis-stat-empty' : ''}`} style={{ '--severity-color': SEVERITY_META[level].color }} key={level}><span><i style={{ background: SEVERITY_META[level].color }} />{SEVERITY_META[level].label}</span><strong>{count}<small>{percent(count)}%</small></strong></div>
      })}</div>{unknownSeverity > 0 && <p className="gis-analysis-note">{unknownSeverity} records have no recognized severity and are not drawn in the heatmap.</p>}<p className="gis-analysis-note">Staff-assigned severity, separate from incident frequency.</p></section>}
      {section === 'types' && <section><h4>Most reported</h4>{categories.map(([label, count]) => <button type="button" key={label} disabled={label === 'Not classified'} aria-pressed={selectedTypes.includes(label)} className="gis-analysis-bar" onClick={() => onSelectedTypes(selectedTypes.includes(label) ? selectedTypes.filter(type => type !== label) : [...selectedTypes,label])}><span><span className="gis-type-name">{colorMode === 'type' && <i style={{ background: typeColors[label] }} />}{label}</span><strong>{count}</strong></span><span className="gis-analysis-track"><i style={{ width: `${percent(count)}%`, background: colorMode === 'type' ? typeColors[label] : undefined }} /></span></button>)}</section>}
      {section === 'time' && <section><h4>Time of day</h4><div className="gis-analysis-times">{periods.map(period => <button type="button" key={period.label} disabled={period.count === 0 && interval !== period.label} aria-pressed={interval === period.label} onClick={() => onInterval(interval === period.label ? TIME_INTERVALS[0] : period.label)}><span>{period.label}</span><strong>{period.count}</strong></button>)}</div>{unknownTime > 0 && <p className="gis-analysis-note">{unknownTime} records have no valid incident time.</p>}</section>}
    </>}
    </div>
    </div>
    <div className="gis-overview-reference">
    {colorMode === 'type' && incidents.length > 0 && <details className="gis-color-key"><summary>Color key <span>{categories.length} types</span></summary><div className="gis-type-legend" aria-label="Incident type colors">{categories.map(([type,count]) => <span key={type}><i style={{ background: typeColors[type] }} />{type}<strong>{count}</strong></span>)}</div></details>}
    {colorMode === 'severity' && incidents.length > 0 && <div className="gis-type-legend" aria-label="Severity color key"><span>Severity · color key</span>{SEVERITY_FILTERS.slice(1).map(level => <span key={level}><i style={{ background: SEVERITY_META[level].color }} />{SEVERITY_META[level].label}</span>)}</div>}
    <details className="gis-map-explanation"><summary>About this heatmap</summary><footer>{colorMode === 'type' ? 'Colors identify incident types.' : 'Colors group incidents by staff-recorded severity.'} Dots show locations; glow shows nearby overlap (18 m radius). Use Pins for individual report details.</footer></details>
    </div>
  </aside>
}
