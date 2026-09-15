import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import {
  MapPin,
  Clock,
  Plus,
  Pencil,
  Search,
  Loader2,
  X,
  Flame,
  MapIcon,
  CheckCircle2,
  XCircle,
  Trash2,
  Inbox,
  ExternalLink,
  User,
} from 'lucide-react'
import {
  ALL_CLASSIFICATIONS,
  TIME_INTERVALS,
  SEVERITY_FILTERS,
  SEVERITY_META,
} from '../data/mockIncidents'
import {
  formatDisplayDateTime,
  formatDisplayDate,
  formatDisplayTime,
  toDatetimeLocalValue,
  generateRef,
  isVerifiedReport,
  getStatusLabel,
} from '../lib/incidentUtils'
import { reverseGeocode, searchAddress } from '../lib/geocode'
import Pill from '../components/Pill'
import ConfirmDialog from '../components/ConfirmDialog'
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
  existingReportId: '',
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const {
    incidents,
    blotterReports,
    addIncident,
    replaceIncident,
    unmapIncidentLocation,
    setIncidentMapStatus,
    deleteIncident,
    addAuditEntry,
  } = useData()
  const { showToast } = useToast()

  const canCreate = can(user.role, 'gis', 'create')
  const canUpdate = can(user.role, 'gis', 'update')
  const canApprove = can(user.role, 'gis', 'approve')
  const canDelete = can(user.role, 'gis', 'delete')

  const [view, setView] = useState('pins') // 'pins' | 'heatmap' | 'pending'
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
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState(null) // { type: 'approve' | 'reject' | 'delete' | 'unmap', incident }

  const mapRef = useRef(null)
  const listRef = useRef(null)

  // Retrieve strictly verified and mapped incidents
  const mappedIncidents = useMemo(() => {
    return incidents.filter(
      (i) =>
        isVerifiedReport(i.status) &&
        (i.is_mapped === true || i.isMapped === true || i.mapStatus === 'Approved') &&
        i.lat != null &&
        i.lng != null &&
        !isNaN(i.lat) &&
        !isNaN(i.lng),
    )
  }, [incidents])

  // Unmapped verified blotter reports available to be mapped via "Pumili ng Verified Blotter Report"
  const unmappedBlotterReports = useMemo(() => {
    return blotterReports.filter((b) => isVerifiedReport(b.status) && !b.is_mapped && !b.isMapped)
  }, [blotterReports])

  const pendingIncidents = useMemo(() => incidents.filter((i) => i.mapStatus === 'Pending'), [incidents])

  const reportedClassifications = useMemo(() => {
    return [...new Set(mappedIncidents.map((i) => i.classification).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [mappedIncidents])

  const filtered = useMemo(() => {
    return mappedIncidents.filter((incident) => {
      if (classification !== ALL_CLASSIFICATIONS && incident.classification !== classification) {
        return false
      }
      if (severity !== SEVERITY_FILTERS[0] && incident.severity !== severity) return false
      if (!inInterval(incident.dateISO, interval)) return false
      if (!inDateRange(incident.dateISO, dateRange)) return false
      return true
    })
  }, [mappedIncidents, classification, interval, severity, dateRange])

  const heatPointsBySeverity = useMemo(() => {
    const grouped = { Mataas: [], Katamtaman: [], Mababa: [] }
    filtered.forEach((i) => {
      if (grouped[i.severity]) grouped[i.severity].push([i.lat, i.lng, 1])
    })
    return grouped
  }, [filtered])

  function focusIncident(incident) {
    setSelectedRef(incident.ref)
    if (mapRef.current && incident.lat != null && incident.lng != null) {
      const zoom = Math.max(mapRef.current.getZoom(), 16)
      mapRef.current.flyTo([incident.lat, incident.lng], zoom)
    }
  }

  // Handle URL navigation query parameters (e.g. from Digital Blotter "Tingnan sa Mapa")
  useEffect(() => {
    const targetId = searchParams.get('id')
    if (targetId) {
      const found = mappedIncidents.find((i) => i.ref === targetId || i.id === targetId)
      if (found) {
        focusIncident(found)
      }
    }

    const mapReportId = searchParams.get('mapReport')
    if (mapReportId) {
      const blotter = blotterReports.find((b) => b.id === mapReportId || b.ref === mapReportId)
      if (blotter) {
        startCreateFromBlotter(blotter)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, mappedIncidents, blotterReports])

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
    setDraft({
      ...BLANK_DRAFT,
      ref: generateRef(incidents.map((i) => i.ref)),
      dateISO: new Date().toISOString(),
    })
  }

  function startCreateFromBlotter(blotter) {
    if (!canCreate) return
    setMode('create')
    setSelectedRef(null)
    setAddressSource('manual')
    setAddressQuery('')
    setAddressResults([])
    setDraft({
      ...BLANK_DRAFT,
      existingReportId: blotter.id,
      ref: blotter.ref || blotter.id,
      title: blotter.narrative
        ? (blotter.narrative.length > 50 ? blotter.narrative.slice(0, 50) + '...' : blotter.narrative)
        : (blotter.incidentType || 'Blotter Report'),
      classification: blotter.incidentType || 'Iba pa',
      severity: blotter.severity || 'Katamtaman',
      excerpt: blotter.narrative || '',
      location: blotter.location || '',
      dateISO: blotter.incidentDateTime || blotter.datetime || new Date().toISOString(),
      lat: blotter.lat || null,
      lng: blotter.lng || null,
    })
    if (blotter.lat && blotter.lng && mapRef.current) {
      mapRef.current.flyTo([blotter.lat, blotter.lng], 16)
    }
  }

  function handleSelectBlotterReport(reportId) {
    if (!reportId) {
      setDraft((d) => ({
        ...d,
        existingReportId: '',
        title: '',
        classification: '',
        excerpt: '',
        location: '',
      }))
      return
    }
    const report = blotterReports.find((b) => b.id === reportId || b.ref === reportId)
    if (!report) return
    setDraft((d) => ({
      ...d,
      existingReportId: report.id,
      ref: report.ref || report.id,
      title: report.narrative
        ? (report.narrative.length > 50 ? report.narrative.slice(0, 50) + '...' : report.narrative)
        : (report.incidentType || 'Blotter Report'),
      classification: report.incidentType || d.classification || 'Iba pa',
      severity: report.severity || d.severity,
      excerpt: report.narrative || d.excerpt,
      location: report.location || d.location,
      dateISO: report.incidentDateTime || report.datetime || d.dateISO,
      lat: report.lat ?? d.lat,
      lng: report.lng ?? d.lng,
    }))
    if (report.lat && report.lng && mapRef.current) {
      mapRef.current.flyTo([report.lat, report.lng], 16)
    }
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

  async function saveForm(e) {
    e.preventDefault()
    if (isSaving) return
    if (draft.lat == null || draft.lng == null) {
      showToast('Pumili muna ng lokasyon sa mapa sa pamamagitan ng pag-click.', 'error')
      return
    }
    const classificationValue = draft.classification.trim()
    if (!classificationValue) {
      showToast('Ilagay ang klasipikasyon ng insidente.', 'error')
      return
    }
    const record = {
      ...draft,
      classification: classificationValue,
      title: draft.title.trim() || classificationValue,
      dateISO: draft.dateISO || new Date().toISOString(),
      mapStatus: 'Approved',
      is_mapped: true,
    }
    const wasCreate = mode === 'create'
    setIsSaving(true)
    try {
      if (wasCreate) {
        await addIncident(record)
        setView('pins')
      } else {
        await replaceIncident(record.ref, record)
      }
      setSelectedRef(record.ref)
      setMode('view')
      setDraft(BLANK_DRAFT)
      addAuditEntry(
        wasCreate ? `Nagdagdag/Nag-mapa ng insidente ${record.ref}` : `Nag-update ng insidente ${record.ref}`,
        { color: 'blue' },
      )
      showToast(
        draft.existingReportId
          ? 'Na-mapa ang blotter report at naidagdag sa mapa.'
          : wasCreate
          ? 'Naidagdag ang insidente sa mapa.'
          : 'Na-update ang insidente.',
      )
      if (mapRef.current && record.lat != null && record.lng != null) {
        mapRef.current.flyTo([record.lat, record.lng], Math.max(mapRef.current.getZoom(), 16))
      }
    } catch (err) {
      console.error('Error saving incident form:', err)
      showToast(err.message || 'Hindi na-save ang insidente. Pakisubukan muli.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function requestApprove(incident) {
    setPendingAction({ type: 'approve', incident })
  }

  function requestReject(incident) {
    setPendingAction({ type: 'reject', incident })
  }

  function requestDelete(incident) {
    setPendingAction({ type: 'delete', incident })
  }

  function requestUnmap(incident) {
    setPendingAction({ type: 'unmap', incident })
  }

  async function confirmPendingAction() {
    if (!pendingAction) return
    const { type, incident } = pendingAction
    if (type === 'approve') {
      await setIncidentMapStatus(incident.ref, 'Approved')
      addAuditEntry(`Na-apruba ang pin ${incident.ref} para sa pampublikong mapa`, { color: 'green' })
      showToast('Naaprubahan ang insidente — nakikita na ito sa mapa.')
    } else if (type === 'reject') {
      await setIncidentMapStatus(incident.ref, 'Rejected')
      addAuditEntry(`Tinanggihan ang pin ${incident.ref} para sa mapa`, { color: 'orange' })
      showToast('Tinanggihan ang insidente — mananatili itong hindi nakikita sa mapa.')
    } else if (type === 'delete') {
      await deleteIncident(incident.ref)
      addAuditEntry(`Binura ang insidente ${incident.ref}`, { color: 'red' })
      showToast('Nabura ang insidente.')
      if (selectedRef === incident.ref) setSelectedRef(null)
    } else if (type === 'unmap') {
      await unmapIncidentLocation(incident.ref)
      addAuditEntry(`Inalis sa mapa ang insidente ${incident.ref}`, { color: 'orange' })
      showToast(`Inalis sa mapa ang insidente ${incident.ref}. Mananatili ito sa blotter.`)
      if (selectedRef === incident.ref) setSelectedRef(null)
    }
    setPendingAction(null)
  }

  const PENDING_ACTION_META = {
    approve: {
      title: 'Aprubahan ang Insidente',
      message: (incident) =>
        `Ipapakita ang ${incident.ref} sa pampublikong Incident Hotspot map. Magpatuloy?`,
      confirmLabel: 'Aprubahan',
      danger: false,
    },
    reject: {
      title: 'Tanggihan ang Insidente',
      message: (incident) =>
        `Hindi ipapakita ang ${incident.ref} sa mapa. Maaari pa rin itong i-review muli. Magpatuloy?`,
      confirmLabel: 'Tanggihan',
      danger: false,
    },
    delete: {
      title: 'Burahin ang Insidente',
      message: (incident) =>
        `Permanenteng buburahin ang ${incident.ref} mula sa system. Hindi na ito mababawi. Magpatuloy?`,
      confirmLabel: 'Burahin',
      danger: true,
    },
    unmap: {
      title: 'Alisin sa Mapa',
      message: (incident) =>
        `Tatanggalin ang lokasyon sa mapa para sa ${incident.ref}. Mananatili pa rin ang ulat sa Digital Blotter bilang "Hindi naka-mapa". Magpatuloy?`,
      confirmLabel: 'Alisin sa Mapa',
      danger: true,
    },
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
  const otherIncidents = isFormMode ? mappedIncidents.filter((i) => i.ref !== draft.ref) : filtered

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-gray-900">
          Incident Hotspot and Pin Mapping
        </h2>
        <div className="flex items-center gap-2">
          {mode === 'view' && (
            <div className="flex rounded-lg border border-gray-200 bg-gray-50/50 p-0.5 shadow-xs">
              <button
                onClick={() => setView('pins')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  view === 'pins' ? 'bg-bb-blue text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <MapIcon size={13} />
                Pin Mapping
              </button>
              <button
                onClick={() => setView('heatmap')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  view === 'heatmap' ? 'bg-bb-blue text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <Flame size={13} />
                Heatmap
              </button>
              {canApprove && (
                <button
                  onClick={() => setView('pending')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    view === 'pending' ? 'bg-bb-blue text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Inbox size={13} />
                  Pending Approval ({pendingIncidents.length})
                </button>
              )}
            </div>
          )}
          {mode === 'view' && canCreate && (
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 rounded-lg bg-bb-blue hover:bg-bb-blue-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
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

      {mode === 'view' && view !== 'pending' && (
        <div className="mt-3 rounded-xl border border-gray-200 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Mga Filter
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">
                Klasipikasyon ng Insidente
              </span>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                <option>{ALL_CLASSIFICATIONS}</option>
                {reportedClassifications.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">
                Interval ng Oras ng Araw
              </span>
              <select
                value={interval}
                onChange={(e) => setIntervalFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {TIME_INTERVALS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">
                Filter ng Kalubhaan
              </span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {SEVERITY_FILTERS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">
                Saklaw ng Petsa
              </span>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {DATE_RANGES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-col rounded-xl border border-gray-200 p-3 lg:h-[calc(100vh-400px)] lg:min-h-[420px] lg:flex-1">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Mapa
            </h3>
            {isFormMode && (
              <span className="flex items-center gap-1 text-xs font-medium text-bb-blue">
                <MapPin size={12} />
                I-click ang mapa para itakda ang eksaktong lokasyon
              </span>
            )}
          </div>
          <div className="relative h-96 overflow-hidden rounded-lg border border-gray-200 lg:h-auto lg:flex-1">
            {isFormMode && draft.lat == null && (
              <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-black/10">
                <span className="rounded-full bg-bb-navy/90 px-4 py-2 text-sm font-semibold text-white shadow-lg">
                  I-click kahit saan sa mapa upang mag-pin
                </span>
              </div>
            )}
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
                  >
                    {!isFormMode && (
                      <Popup className="bb-map-popup" minWidth={250}>
                        <div className="p-1 text-xs">
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="font-bold text-gray-700">Incident No.: {incident.ref}</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              Naka-mapa na
                            </span>
                          </div>
                          <div className="mb-2">
                            <div className="text-sm font-bold text-gray-900">{incident.classification || incident.title}</div>
                            <div className="text-[11px] text-gray-500">{incident.location}</div>
                          </div>
                          <div className="space-y-1 text-gray-600 mb-3 text-[11px] border-t border-b border-gray-100 py-1.5">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Date:</span>
                              <span className="font-medium text-gray-700">{formatDisplayDate(incident.dateISO)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Time:</span>
                              <span className="font-medium text-gray-700">{formatDisplayTime(incident.dateISO)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Severity:</span>
                              <span className="font-medium" style={{ color: SEVERITY_META[incident.severity]?.color || '#444' }}>
                                {incident.severity}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Status:</span>
                              <span className="font-semibold text-bb-blue">
                                {getStatusLabel(incident.status)}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate(`/blotter?id=${incident.ref}`)}
                            className="w-full flex items-center justify-center gap-1.5 rounded-md bg-bb-blue hover:bg-bb-blue-dark text-white font-medium py-1.5 px-2 transition-colors cursor-pointer"
                          >
                            <ExternalLink size={12} />
                            Tingnan ang Blotter
                          </button>
                        </div>
                      </Popup>
                    )}
                  </Marker>
                ))}

              {view === 'pending' && !isFormMode &&
                pendingIncidents.map((incident) => (
                  <Marker
                    key={incident.ref}
                    position={[incident.lat, incident.lng]}
                    icon={severityIcon(incident.severity)}
                    eventHandlers={{ click: () => focusIncident(incident) }}
                  >
                    <Popup className="bb-map-popup" minWidth={240}>
                      <div className="p-1 text-xs">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-bold text-gray-700">{incident.ref}</span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                            Naghihintay ng Pag-apruba
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm mb-1">{incident.title || incident.classification}</h4>
                        <p className="text-gray-600 mb-2 line-clamp-2">{incident.excerpt}</p>
                        <button
                          type="button"
                          onClick={() => navigate(`/blotter?id=${incident.ref}`)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-md bg-bb-blue hover:bg-bb-blue-dark text-white font-medium py-1.5 px-2 transition-colors cursor-pointer"
                        >
                          <ExternalLink size={12} />
                          Tingnan ang Blotter
                        </button>
                      </div>
                    </Popup>
                  </Marker>
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
        </div>

        <div className="flex w-full flex-col rounded-xl border border-gray-200 p-4 lg:h-[calc(100vh-400px)] lg:min-h-[420px] lg:w-96">
          {mode === 'view' && view !== 'pending' && (
            <>
              <h3 className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Mga Insidente ({filtered.length})
              </h3>

              <div
                ref={listRef}
                className="space-y-3 scroll-smooth lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
              >
                {filtered.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                    Walang insidenteng tumutugma sa napiling filter.
                  </p>
                )}
                {filtered.map((incident) => {
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
                          <Pill color={incident.status === 'Nareselba' ? 'green' : 'blue'}>
                            {getStatusLabel(incident.status)}
                          </Pill>
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/blotter?id=${incident.ref}`)
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:shadow transition-all active:scale-[0.96] cursor-pointer"
                        >
                          <ExternalLink size={12} />
                          Tingnan ang Blotter
                        </button>
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEdit(incident)
                            }}
                            className="flex items-center gap-1.5 rounded-lg bg-bb-blue hover:bg-bb-blue-dark px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:shadow transition-all active:scale-[0.96] cursor-pointer"
                          >
                            <Pencil size={12} />
                            I-edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            requestUnmap(incident)
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-xs hover:shadow transition-all active:scale-[0.96] cursor-pointer"
                          title="Alisin ang pin sa mapa nang hindi binubura ang ulat sa blotter"
                        >
                          <XCircle size={12} />
                          Alisin sa Mapa
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {mode === 'view' && view === 'pending' && (
            <>
              <h3 className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Naghihintay ng Pag-apruba ({pendingIncidents.length})
              </h3>

              <div className="space-y-3 scroll-smooth lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                {pendingIncidents.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                    Walang insidenteng naghihintay ng pag-apruba.
                  </p>
                )}
                {pendingIncidents.map((incident) => {
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
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/blotter?id=${incident.ref}`)
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:shadow transition-all active:scale-[0.96] cursor-pointer"
                        >
                          <ExternalLink size={12} />
                          Tingnan ang Blotter
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            requestApprove(incident)
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:shadow transition-all active:scale-[0.96] cursor-pointer"
                        >
                          <CheckCircle2 size={12} />
                          Aprubahan
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            requestReject(incident)
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:shadow transition-all active:scale-[0.96] cursor-pointer"
                        >
                          <XCircle size={12} />
                          Tanggihan
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {isFormMode && (
            <form
              onSubmit={saveForm}
              className="space-y-4 overflow-y-auto rounded-lg border border-bb-blue/40 p-4 lg:min-h-0 lg:flex-1"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-bb-blue">
                  {mode === 'create' ? 'Bagong Insidente' : `I-edit: ${draft.ref}`}
                </h3>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={isSaving}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                >
                  <X size={18} />
                </button>
              </div>

              {mode === 'create' && unmappedBlotterReports.length > 0 && (
                <div className="rounded-lg border border-bb-blue/20 bg-blue-50/50 p-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-bb-navy">
                      Pumili ng Verified Blotter Report
                    </span>
                    <select
                      value={draft.existingReportId || ''}
                      onChange={(e) => handleSelectBlotterReport(e.target.value)}
                      className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                    >
                      <option value="">-- Bagong Insidente (Manu-mano) --</option>
                      {unmappedBlotterReports.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.ref} – {b.title || b.incidentType || 'Kaganapan'} – {getStatusLabel(b.status)}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[11px] text-gray-500">
                      Piliin ang isang nakumpirmang blotter report upang i-link ang lokasyon nang hindi gumagawa ng duplicate.
                    </span>
                  </label>
                </div>
              )}

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
                  disabled={draft.lat == null || isSaving}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-bb-blue hover:bg-bb-blue-dark py-2 text-sm font-semibold text-white shadow-sm hover:shadow transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Sine-save...</span>
                    </>
                  ) : (
                    <span>I-save ang Insidente</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-all active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                >
                  Kanselahin
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingAction != null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        title={pendingAction ? PENDING_ACTION_META[pendingAction.type].title : ''}
        message={pendingAction ? PENDING_ACTION_META[pendingAction.type].message(pendingAction.incident) : ''}
        confirmLabel={pendingAction ? PENDING_ACTION_META[pendingAction.type].confirmLabel : 'Kumpirmahin'}
        danger={pendingAction ? PENDING_ACTION_META[pendingAction.type].danger : false}
      />
    </div>
  )
}
