import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvent } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { MapPin, Clock, Plus, Pencil, Search, Loader2, X, Flame, MapIcon } from 'lucide-react'
import {
  ALL_CLASSIFICATIONS,
  TIME_INTERVALS,
  SEVERITY_FILTERS,
  SEVERITY_META,
} from '../data/mockIncidents'
import { formatDisplayDateTime, toDatetimeLocalValue, generateRef } from '../lib/incidentUtils'
import { reverseGeocode, searchAddress } from '../lib/geocode'
import Pill from '../components/Pill'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { can } from '../config/permissions'

const SEVERITY_OPTIONS = SEVERITY_FILTERS.slice(1)
const SEVERITY_PILL_COLOR = { Mataas: 'red', Katamtaman: 'orange', Mababa: 'green' }
const DEFAULT_CENTER = [14.6768, 121.0453]

const DATE_RANGES = ['Lahat ng Petsa', 'Huling 7 Araw', 'Huling 30 Araw']

const BLANK_DRAFT = {
  ref: '',
  title: '',
  classification: '',
  severity: 'Katamtaman',
  excerpt: '',
  location: '',
  dateISO: '',
  lat: null,
  lng: null,
}

function severityIcon(severity, { dimmed = false } = {}) {
  const color = SEVERITY_META[severity]?.color ?? '#888'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45);opacity:${dimmed ? 0.35 : 1}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function draftIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#0b3d66;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  })
}

function inInterval(dateISO, interval) {
  const hour = new Date(dateISO).getHours()
  if (interval === 'Anumang Oras') return true
  if (interval.startsWith('Umaga')) return hour >= 6 && hour < 12
  if (interval.startsWith('Hapon')) return hour >= 12 && hour < 18
  if (interval.startsWith('Gabi')) return hour >= 18 && hour < 24
  if (interval.startsWith('Madaling')) return hour >= 0 && hour < 6
  return true
}

function inDateRange(dateISO, range) {
  if (range === 'Lahat ng Petsa') return true
  const days = range === 'Huling 7 Araw' ? 7 : 30
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return new Date(dateISO).getTime() >= cutoff
}

function ClickCapture({ active, onPick }) {
  useMapEvent('click', (e) => {
    if (active) onPick(e.latlng)
  })
  return null
}

function MapController({ onReady }) {
  const map = useMap()
  useEffect(() => {
    onReady(map)
  }, [map, onReady])
  return null
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

// A single-hue gradient (transparent -> that severity's own color) so the
// heatmap's color at any point means exactly what the pin color means:
// red = Mataas, orange = Katamtaman, green = Mababa. Leaflet.heat only
// supports one gradient per layer, so each severity gets its own layer
// stacked on the map instead of everything sharing one generic
// blue-to-red density gradient that would misrepresent severity as density.
function severityGradient(hex) {
  const { r, g, b } = hexToRgb(hex)
  const rgba = (a) => `rgba(${r},${g},${b},${a})`
  return { 0.15: rgba(0), 0.4: rgba(0.45), 0.7: rgba(0.75), 1: rgba(1) }
}

function HeatmapLayer({ pointsBySeverity }) {
  const map = useMap()
  useEffect(() => {
    const layers = Object.entries(pointsBySeverity)
      .filter(([, points]) => points.length)
      .map(([severity, points]) =>
        L.heatLayer(points, {
          radius: 30,
          blur: 24,
          maxZoom: 17,
          max: 1,
          gradient: severityGradient(SEVERITY_META[severity]?.color ?? '#888'),
        }).addTo(map),
      )
    return () => {
      layers.forEach((layer) => map.removeLayer(layer))
    }
  }, [map, pointsBySeverity])
  return null
}

export default function GISCommandCenter() {
  const { user } = useAuth()
  const { incidents, addIncident, replaceIncident, addAuditEntry } = useData()
  const { showToast } = useToast()

  const canCreate = can(user.role, 'gis', 'create')
  const canUpdate = can(user.role, 'gis', 'update')

  const [view, setView] = useState('pins') // 'pins' | 'heatmap'
  const [classification, setClassification] = useState(ALL_CLASSIFICATIONS)
  const [interval, setIntervalFilter] = useState(TIME_INTERVALS[0])
  const [severity, setSeverity] = useState(SEVERITY_FILTERS[0])
  const [dateRange, setDateRange] = useState(DATE_RANGES[0])
  const [selectedRef, setSelectedRef] = useState(null)

  const [mode, setMode] = useState('view') // 'view' | 'create' | 'edit'
  const [draft, setDraft] = useState(BLANK_DRAFT)
  const [addressSource, setAddressSource] = useState('auto') // 'auto' | 'manual'
  const [geocoding, setGeocoding] = useState(false)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [searching, setSearching] = useState(false)

  const mapRef = useRef(null)
  const listRef = useRef(null)

  const reportedClassifications = useMemo(() => {
    return [...new Set(incidents.map((i) => i.classification).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [incidents])

  const filtered = useMemo(() => {
    return incidents.filter((incident) => {
      if (classification !== ALL_CLASSIFICATIONS && incident.classification !== classification) {
        return false
      }
      if (severity !== SEVERITY_FILTERS[0] && incident.severity !== severity) return false
      if (!inInterval(incident.dateISO, interval)) return false
      if (!inDateRange(incident.dateISO, dateRange)) return false
      return true
    })
  }, [incidents, classification, interval, severity, dateRange])

  const heatPointsBySeverity = useMemo(() => {
    const grouped = { Mataas: [], Katamtaman: [], Mababa: [] }
    filtered.forEach((i) => {
      if (grouped[i.severity]) grouped[i.severity].push([i.lat, i.lng, 1])
    })
    return grouped
  }, [filtered])

  const orderedFiltered = useMemo(() => {
    if (!selectedRef) return filtered
    const index = filtered.findIndex((i) => i.ref === selectedRef)
    if (index <= 0) return filtered
    const copy = [...filtered]
    const [selectedIncident] = copy.splice(index, 1)
    copy.unshift(selectedIncident)
    return copy
  }, [filtered, selectedRef])

  function focusIncident(incident) {
    setSelectedRef(incident.ref)
    if (mapRef.current) {
      const zoom = Math.max(mapRef.current.getZoom(), 16)
      mapRef.current.flyTo([incident.lat, incident.lng], zoom)
    }
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (classification !== ALL_CLASSIFICATIONS && !reportedClassifications.includes(classification)) {
      setClassification(ALL_CLASSIFICATIONS)
    }
  }, [classification, reportedClassifications])

  useEffect(() => {
    if (mode === 'view' || draft.lat == null || draft.lng == null || addressSource === 'manual') {
      return
    }
    const { lat, lng } = draft
    let cancelled = false
    setGeocoding(true)
    reverseGeocode(lat, lng).then((label) => {
      if (cancelled) return
      setGeocoding(false)
      setDraft((d) => ({ ...d, location: label ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}` }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.lat, draft.lng, mode])

  function startCreate() {
    if (!canCreate) return
    setMode('create')
    setSelectedRef(null)
    setAddressSource('auto')
    setAddressQuery('')
    setAddressResults([])
    setDraft({ ...BLANK_DRAFT, ref: generateRef(incidents.map((i) => i.ref)) })
  }

  function startEdit(incident) {
    if (!canUpdate) return
    setMode('edit')
    setAddressSource('manual')
    setAddressQuery('')
    setAddressResults([])
    setDraft({ ...incident })
  }

  function cancelForm() {
    setMode('view')
    setDraft(BLANK_DRAFT)
  }

  function saveForm(e) {
    e.preventDefault()
    if (draft.lat == null || draft.lng == null) return
    const classificationValue = draft.classification.trim()
    const record = {
      ...draft,
      classification: classificationValue,
      title: draft.title.trim() || classificationValue,
    }
    const wasCreate = mode === 'create'
    if (wasCreate) addIncident(record)
    else replaceIncident(record.ref, record)
    setSelectedRef(record.ref)
    setMode('view')
    setDraft(BLANK_DRAFT)
    addAuditEntry(
      wasCreate ? `Nagdagdag ng insidente ${record.ref}` : `Nag-update ng insidente ${record.ref}`,
      { color: 'blue' },
    )
    showToast(wasCreate ? 'Naidagdag ang bagong insidente.' : 'Na-update ang insidente.')
  }

  function pickPosition(latlng) {
    setAddressSource('auto')
    setDraft((d) => ({ ...d, lat: latlng.lat, lng: latlng.lng }))
  }

  async function runAddressSearch() {
    if (!addressQuery.trim()) return
    setSearching(true)
    const results = await searchAddress(addressQuery)
    setSearching(false)
    setAddressResults(results)
  }

  function chooseAddressResult(result) {
    setAddressSource('auto')
    setDraft((d) => ({ ...d, lat: result.lat, lng: result.lng, location: result.label }))
    setAddressResults([])
    setAddressQuery('')
    mapRef.current?.flyTo([result.lat, result.lng], 17)
  }

  const isFormMode = mode === 'create' || mode === 'edit'
  const otherIncidents = isFormMode ? incidents.filter((i) => i.ref !== draft.ref) : filtered

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-900">
          Incident Hotspot and Pin Mapping
        </h2>
        <div className="flex items-center gap-2">
          {mode === 'view' && (
            <div className="flex rounded-full border border-gray-200 p-0.5">
              <button
                onClick={() => setView('pins')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === 'pins' ? 'bg-bb-blue text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MapIcon size={13} />
                Pin Mapping
              </button>
              <button
                onClick={() => setView('heatmap')}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === 'heatmap' ? 'bg-bb-blue text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Flame size={13} />
                Heatmap
              </button>
            </div>
          )}
          {mode === 'view' && canCreate && (
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 rounded-full bg-bb-blue px-4 py-2 text-sm font-semibold text-white hover:bg-bb-blue-dark transition-colors"
            >
              <Plus size={16} />
              Magdagdag ng Insidente
            </button>
          )}
        </div>
      </div>

      {isFormMode && (
        <p className="mt-1 text-sm text-bb-blue">
          I-click ang mapa, o hanapin ang address sa ibaba, upang itakda ang eksaktong
          lokasyon. Maaari ring i-drag ang pin para sa pinal na ayos.
        </p>
      )}

      {view === 'heatmap' && !isFormMode && (
        <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span>Kulay ng heatmap ayon sa kalubhaan:</span>
          {SEVERITY_OPTIONS.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SEVERITY_META[s].color }}
              />
              {s} ({SEVERITY_META[s].label})
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-gray-200 p-4 lg:flex-row">
        <div className="h-96 shrink-0 overflow-hidden rounded-lg border border-gray-200 lg:h-[560px] lg:flex-1">
          <MapContainer center={DEFAULT_CENTER} zoom={15} className="h-full w-full">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController onReady={(map) => (mapRef.current = map)} />
            <ClickCapture active={isFormMode} onPick={pickPosition} />

            {view === 'heatmap' && !isFormMode && (
              <HeatmapLayer pointsBySeverity={heatPointsBySeverity} />
            )}

            {(view === 'pins' || isFormMode) &&
              otherIncidents.map((incident) => (
                <Marker
                  key={incident.ref}
                  position={[incident.lat, incident.lng]}
                  icon={severityIcon(incident.severity, { dimmed: isFormMode })}
                  eventHandlers={isFormMode ? {} : { click: () => focusIncident(incident) }}
                />
              ))}

            {isFormMode && draft.lat != null && draft.lng != null && (
              <Marker
                position={[draft.lat, draft.lng]}
                icon={draftIcon()}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng()
                    setAddressSource('auto')
                    setDraft((d) => ({ ...d, lat, lng }))
                  },
                }}
              />
            )}
          </MapContainer>
        </div>

        <div className="w-full space-y-4 lg:w-96">
          {mode === 'view' && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Klasipikasyon ng Insidente
                </span>
                <select
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                >
                  <option>{ALL_CLASSIFICATIONS}</option>
                  {reportedClassifications.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Interval ng Oras ng Araw
                </span>
                <select
                  value={interval}
                  onChange={(e) => setIntervalFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                >
                  {TIME_INTERVALS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Filter ng Kalubhaan
                </span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                >
                  {SEVERITY_FILTERS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Saklaw ng Petsa
                </span>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                >
                  {DATE_RANGES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-gray-500">
                  Mga Insidente ({filtered.length})
                </span>
              </div>

              <div ref={listRef} className="max-h-[420px] space-y-3 overflow-y-auto pr-1 scroll-smooth">
                {filtered.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                    Walang insidenteng tumutugma sa napiling filter.
                  </p>
                )}
                {orderedFiltered.map((incident) => {
                  const isSelected = incident.ref === selectedRef
                  return (
                    <div
                      key={incident.ref}
                      onClick={() => focusIncident(incident)}
                      className={`cursor-pointer rounded-lg border p-4 shadow-sm transition-colors ${
                        isSelected
                          ? 'border-bb-blue bg-bb-blue-light ring-1 ring-bb-blue'
                          : 'border-gray-200 hover:border-bb-blue/50'
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-400">{incident.ref}</span>
                        <div className="flex items-center gap-1.5">
                          <Pill color="gray">{incident.classification}</Pill>
                          <Pill color={SEVERITY_PILL_COLOR[incident.severity]} solid>
                            {SEVERITY_META[incident.severity].label}
                          </Pill>
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900">{incident.title}</h3>
                      <p className="mt-1 text-sm text-gray-500">{incident.excerpt}</p>
                      <div className="mt-3 space-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} />
                          {incident.location}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} />
                          {formatDisplayDateTime(incident.dateISO)}
                        </div>
                      </div>
                      {canUpdate && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(incident)
                            }}
                            className="flex items-center gap-1.5 rounded-full bg-bb-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-bb-blue-dark"
                          >
                            <Pencil size={12} />
                            I-edit
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {isFormMode && (
            <form onSubmit={saveForm} className="space-y-4 rounded-lg border border-bb-blue/40 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-bb-blue">
                  {mode === 'create' ? 'Bagong Insidente' : `I-edit: ${draft.ref}`}
                </h3>
                <button type="button" onClick={cancelForm} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Hanapin ang Address
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressQuery}
                    onChange={(e) => setAddressQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        runAddressSearch()
                      }
                    }}
                    placeholder="hal. Rizal St., Quezon City"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                  />
                  <button
                    type="button"
                    onClick={runAddressSearch}
                    className="flex shrink-0 items-center justify-center rounded-lg bg-gray-100 px-3 text-gray-600 hover:bg-gray-200"
                  >
                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  </button>
                </div>
                {addressResults.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 text-sm">
                    {addressResults.map((r, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => chooseAddressResult(r)}
                          className="block w-full px-3 py-2 text-left hover:bg-bb-blue-light"
                        >
                          {r.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </label>

              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                {draft.lat != null ? (
                  <span>
                    Lat/Lng: {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-orange-500">
                    Wala pang napiling lokasyon — i-click ang mapa.
                  </span>
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Lokasyon / Address
                </span>
                <input
                  type="text"
                  required
                  value={draft.location}
                  onChange={(e) => {
                    setAddressSource('manual')
                    setDraft((d) => ({ ...d, location: e.target.value }))
                  }}
                  placeholder={geocoding ? 'Kinukuha ang address...' : 'Address ng insidente'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Klasipikasyon
                </span>
                <input
                  type="text"
                  required
                  list="classification-suggestions"
                  value={draft.classification}
                  onChange={(e) => setDraft((d) => ({ ...d, classification: e.target.value }))}
                  placeholder="i-type ang klasipikasyon, hal. Ingay"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
                <datalist id="classification-suggestions">
                  {reportedClassifications.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <span className="mt-1 block text-xs text-gray-400">
                  Piliin ang mungkahi o mag-type ng bago — awtomatiko itong idadagdag sa
                  filter.
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">Pamagat</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder={draft.classification}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">Kalubhaan</span>
                <select
                  value={draft.severity}
                  onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Petsa at Oras
                </span>
                <input
                  type="datetime-local"
                  required
                  value={draft.dateISO ? toDatetimeLocalValue(draft.dateISO) : ''}
                  onChange={(e) => setDraft((d) => ({ ...d, dateISO: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-500">Buod</span>
                <textarea
                  required
                  rows={3}
                  value={draft.excerpt}
                  onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={draft.lat == null}
                  className="flex-1 rounded-full bg-bb-blue py-2 text-sm font-semibold text-white transition-colors hover:bg-bb-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  I-save ang Insidente
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                >
                  Kanselahin
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
