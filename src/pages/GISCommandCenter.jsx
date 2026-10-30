import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMap, useMapEvent } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import {
  MapPin,
  Clock,
  Plus,
  Search,
  Loader2,
  X,
  Flame,
  MapIcon,
  CheckCircle2,
  XCircle,
  Trash2,
  Inbox,
  Info,
  SlidersHorizontal,
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
  toDatetimeLocalValue,
  generateRef,
  isVerifiedReport,
  getStatusLabel,
} from '../lib/incidentUtils'
import { reverseGeocode, searchAddress } from '../lib/geocode'
import { MilagrosaMapArea, MILAGROSA_CENTER } from '../components/MilagrosaMapArea'
import Pill from '../components/Pill'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { can } from '../config/permissions'

const SEVERITY_OPTIONS = SEVERITY_FILTERS.slice(1)
const SEVERITY_PILL_COLOR = { Mataas: 'red', Katamtaman: 'orange', Mababa: 'green' }
const DEFAULT_CENTER = MILAGROSA_CENTER

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

function severityIcon(severity, { dimmed = false, selected = false } = {}) {
  const color = SEVERITY_META[severity]?.color ?? '#888888'
  const size = 12
  const { r, g, b } = hexToRgb(color)
  const arrowGradientId = `incident-arrow-${String(severity).replace(/[^a-z0-9]/gi, '')}`
  const marker = `<div style="position:absolute;left:20px;top:44px;box-sizing:border-box;background:${color};width:${size}px;height:${size}px;border-radius:2px;border:2px solid white;transform:rotate(45deg);box-shadow:0 0 0 3px ${color};"></div>`
  return L.divIcon({
    className: '',
    html: selected
      ? `<div style="position:relative;width:52px;height:62px;pointer-events:none"><div style="position:absolute;left:6px;top:32px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(${r},${g},${b},.5),rgba(${r},${g},${b},0) 72%)"></div><svg style="position:absolute;left:0;top:0;filter:drop-shadow(0 0 5px rgba(${r},${g},${b},.65))" width="52" height="36" viewBox="0 0 52 36" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs><linearGradient id="${arrowGradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset=".55" stop-color="#f4f9ff"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><path d="M26 3v27m-9-9 9 9 9-9" stroke="white" stroke-width="8"/><path d="M26 3v27m-9-9 9 9 9-9" stroke="url(#${arrowGradientId})" stroke-width="4"/></svg>${marker}</div>`
      : `<div style="box-sizing:border-box;background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);opacity:${dimmed ? 0.35 : 1}"></div>`,
    iconSize: selected ? [52, 62] : [size, size],
    iconAnchor: selected ? [26, 50] : [size / 2, size / 2],
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
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [incidentQuery, setIncidentQuery] = useState('')
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

  useEffect(() => {
    if (!selectedRef || !listRef.current) return
    const row = Array.from(listRef.current.querySelectorAll('[data-incident-ref]'))
      .find((element) => element.getAttribute('data-incident-ref') === String(selectedRef))
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedRef, view])

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
    return blotterReports.filter((b) => {
      if (!isVerifiedReport(b.status)) return false
      if (b.is_mapped === true || b.isMapped === true) return false
      if (b.mapStatus === 'Approved' && b.lat != null && b.lng != null) return false
      const alreadyMapped = mappedIncidents.some(
        (m) =>
          m.ref === b.id ||
          m.id === b.id ||
          m.ref === b.ref ||
          (b.blotterId && String(m.blotterId) === String(b.blotterId)),
      )
      return !alreadyMapped
    })
  }, [blotterReports, mappedIncidents])

  const pendingIncidents = useMemo(() => incidents.filter((i) => i.mapStatus === 'Pending'), [incidents])

  const reportedClassifications = useMemo(() => {
    return [...new Set(mappedIncidents.map((i) => i.classification).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [mappedIncidents])

  const filterableIncidents = useMemo(() => mappedIncidents.filter((incident) =>
    inInterval(incident.dateISO, interval) && inDateRange(incident.dateISO, dateRange),
  ), [mappedIncidents, interval, dateRange])

  const availableClassifications = useMemo(() => [...new Set(filterableIncidents
    .filter((incident) => severity === SEVERITY_FILTERS[0] || incident.severity === severity)
    .map((incident) => incident.classification)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b)), [filterableIncidents, severity])

  const availableSeverities = useMemo(() => SEVERITY_FILTERS.slice(1).filter((level) =>
    filterableIncidents.some((incident) => incident.severity === level),
  ), [filterableIncidents])

  const filtered = useMemo(() => {
    const query = incidentQuery.trim().toLocaleLowerCase()
    return filterableIncidents.filter((incident) => {
      if (query && ![incident.ref, incident.title, incident.classification, incident.location]
        .some((value) => String(value ?? '').toLocaleLowerCase().includes(query))) return false
      if (classification !== ALL_CLASSIFICATIONS && incident.classification !== classification) {
        return false
      }
      if (severity !== SEVERITY_FILTERS[0] && incident.severity !== severity) return false
      return true
    })
  }, [filterableIncidents, incidentQuery, classification, severity])

  function selectSeverity(nextSeverity) {
    setSeverity(nextSeverity)
    if (classification !== ALL_CLASSIFICATIONS && nextSeverity !== SEVERITY_FILTERS[0] &&
      !filterableIncidents.some((incident) => incident.severity === nextSeverity && incident.classification === classification)) {
      setClassification(ALL_CLASSIFICATIONS)
    }
  }

  function selectClassification(nextClassification) {
    setClassification(nextClassification)
    if (severity !== SEVERITY_FILTERS[0] && nextClassification !== ALL_CLASSIFICATIONS &&
      !filterableIncidents.some((incident) => incident.classification === nextClassification && incident.severity === severity)) {
      setSeverity(SEVERITY_FILTERS[0])
    }
  }

  const activeFilterCount = [
    classification !== ALL_CLASSIFICATIONS,
    interval !== TIME_INTERVALS[0],
    severity !== SEVERITY_FILTERS[0],
    dateRange !== DATE_RANGES[0],
  ].filter(Boolean).length

  function clearFilters() {
    setClassification(ALL_CLASSIFICATIONS)
    setIntervalFilter(TIME_INTERVALS[0])
    setSeverity(SEVERITY_FILTERS[0])
    setDateRange(DATE_RANGES[0])
    setIncidentQuery('')
  }

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
      const zoom = Math.max(mapRef.current.getZoom(), 18)
      mapRef.current.flyTo([Number(incident.lat), Number(incident.lng)], zoom, { duration: 0.35 })
    }
  }

  // Handle URL navigation query parameters (e.g. from Digital Blotter "Tingnan sa Mapa")
  useEffect(() => {
    const targetId = searchParams.get('id')
    if (targetId) {
      const found = mappedIncidents.find(
        (i) => i.ref === targetId || i.id === targetId || (i.blotterId && String(i.blotterId) === targetId)
      )
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
    if (classification !== ALL_CLASSIFICATIONS && !availableClassifications.includes(classification)) {
      setClassification(ALL_CLASSIFICATIONS)
    }
  }, [classification, availableClassifications])

  useEffect(() => {
    if (severity !== SEVERITY_FILTERS[0] && !availableSeverities.includes(severity)) {
      setSeverity(SEVERITY_FILTERS[0])
    }
  }, [severity, availableSeverities])

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
        `Tatanggalin ang lokasyon sa mapa para sa ${incident.ref}. Mananatili pa rin ang ulat sa talaan bilang "Hindi naka-mapa". Magpatuloy?`,
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
  const visibleIncidents = view === 'pending' ? pendingIncidents : filtered
  const selectedIncident = visibleIncidents.find((incident) => incident.ref === selectedRef)
  const severityGroups = [...SEVERITY_FILTERS.slice(1), 'Hindi natukoy']
    .map((level) => ({
      level,
      items: filtered.filter((incident) =>
        level === 'Hindi natukoy'
          ? !SEVERITY_FILTERS.slice(1).includes(incident.severity)
          : incident.severity === level,
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">GIS Command Center</h2>
          <p className="mt-1 text-sm text-gray-500">Mga insidente sa Barangay Milagrosa</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setGuideOpen((open) => !open)} aria-expanded={guideOpen} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:border-blue-200 hover:bg-blue-50">
            <Info size={16} /> Gabay
          </button>
          {mode === 'view' && canCreate && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 rounded-lg bg-bb-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-bb-blue-dark"
          >
            <Plus size={16} />
            Mag-mapa ng insidente
          </button>
          )}
        </div>
      </div>

      {(guideOpen || isFormMode) && <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bb-blue">
          {isFormMode ? 'Pagmamapa ng insidente' : view === 'pending' ? 'Pag-apruba ng lokasyon' : 'Paano gamitin'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
          {(isFormMode
            ? ['1. Piliin ang ulat kung mayroon', '2. Itakda ang pin sa mapa', '3. Suriin at i-save']
            : view === 'pending'
              ? ['1. Pumili ng naghihintay', '2. Suriin ang ulat at lokasyon', '3. Aprubahan o tanggihan']
              : ['1. Hanapin ang insidente', '2. Piliin sa listahan o mapa', '3. Suriin at aksyunan']
          ).map((step, index) => (
            <span key={step} className="flex items-center gap-3">
              {index > 0 && <span className="hidden text-blue-300 sm:inline" aria-hidden="true">→</span>}
              {step}
            </span>
          ))}
        </div>
      </div>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {mode === 'view' && (
            <div role="tablist" aria-label="Tingnan ang mapa" className="flex max-w-full overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1 shadow-xs">
              <button
                role="tab"
                aria-selected={view === 'pins'}
                onClick={() => setView('pins')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  view === 'pins' ? 'bg-bb-blue text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                <MapIcon size={13} />
                Mga pin ({mappedIncidents.length})
              </button>
              <button
                role="tab"
                aria-selected={view === 'heatmap'}
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
                  role="tab"
                  aria-selected={view === 'pending'}
                  onClick={() => setView('pending')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    view === 'pending' ? 'bg-bb-blue text-white shadow-xs' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Inbox size={13} />
                  Para aprubahan ({pendingIncidents.length})
                </button>
              )}
            </div>
          )}
        </div>
        {mode === 'view' && view !== 'pending' && (
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="gis-filters"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-bb-blue/50 hover:bg-blue-50 hover:text-bb-blue"
          >
            <SlidersHorizontal size={16} /> Mga filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        )}
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

      {mode === 'view' && view !== 'pending' && filtersOpen && (
        <div id="gis-filters" className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paliitin ang resulta</h3>
            {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-bb-blue hover:underline">I-clear ang mga filter</button>}
          </div>
          <p className="mb-3 text-xs text-gray-500">Ang mga pagpipilian ay batay sa mga insidenteng nasa napiling petsa at kalubhaan.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">
                Klasipikasyon ng Insidente
              </span>
              <select
                value={classification}
                onChange={(e) => selectClassification(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                <option>{ALL_CLASSIFICATIONS}</option>
                {availableClassifications.map((c) => (
                  <option key={c} value={c}>{c} ({filterableIncidents.filter((incident) => incident.classification === c && (severity === SEVERITY_FILTERS[0] || incident.severity === severity)).length})</option>
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
                onChange={(e) => selectSeverity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                <option value={SEVERITY_FILTERS[0]}>{SEVERITY_FILTERS[0]}</option>
                {availableSeverities.map((s) => (
                  <option key={s} value={s}>{s} ({filterableIncidents.filter((incident) => incident.severity === s).length})</option>
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

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.15fr)]">
        <div className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:h-[clamp(460px,62vh,680px)]">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Mapa ng Milagrosa
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
            <MapContainer center={DEFAULT_CENTER} zoom={15} maxZoom={19} className="h-full w-full">
              <MilagrosaMapArea />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
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
                    icon={severityIcon(incident.severity, { dimmed: isFormMode, selected: incident.ref === selectedRef && !isFormMode })}
                    zIndexOffset={incident.ref === selectedRef ? 1000 : 0}
                    eventHandlers={isFormMode ? {} : { click: () => focusIncident(incident) }}
                  />
                ))}

              {view === 'pending' && !isFormMode &&
                pendingIncidents.map((incident) => (
                  <Marker
                    key={incident.ref}
                    position={[incident.lat, incident.lng]}
                    icon={severityIcon(incident.severity, { selected: incident.ref === selectedRef })}
                    zIndexOffset={incident.ref === selectedRef ? 1000 : 0}
                    eventHandlers={{ click: () => focusIncident(incident) }}
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
        </div>

        <div className="flex min-w-0 w-full flex-col rounded-xl border border-gray-200 p-4 lg:h-[clamp(460px,62vh,680px)] xl:grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:gap-3 xl:border-0 xl:p-0">
          <div className={`min-h-0 min-w-0 flex-col lg:flex-1 xl:flex-none xl:rounded-2xl xl:border xl:border-gray-200 xl:bg-white xl:p-4 xl:shadow-sm ${isFormMode ? 'hidden' : 'flex'}`}>
          {mode === 'view' && view !== 'pending' && (
            <>
              <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">Mga Insidente</h3>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{filtered.length}</span>
              </div>

              <label className="relative mb-3 block shrink-0">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={incidentQuery}
                  onChange={(event) => setIncidentQuery(event.target.value)}
                  placeholder="Hanapin ang ulat o lokasyon"
                  aria-label="Hanapin ang insidente"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-bb-blue focus:bg-white"
                />
              </label>

              <div
                ref={listRef}
                className="space-y-3 scroll-smooth lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
              >
                {filtered.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                    <p>{mappedIncidents.length === 0 ? 'Wala pang naka-mapang insidente.' : 'Walang tumutugma sa hinahanap mo.'}</p>
                    {mappedIncidents.length > 0 && (incidentQuery || activeFilterCount > 0) && (
                      <button type="button" onClick={clearFilters} className="mt-2 font-semibold text-bb-blue hover:underline">Ipakita ang lahat</button>
                    )}
                  </div>
                )}
                {severityGroups.map(({ level, items }) => (
                  <section key={level} aria-label={`Kalubhaan: ${level}`}>
                    <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-1.5">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-600"><span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_META[level]?.color || '#888' }} />Kalubhaan: {level}</h4>
                      <span className="text-xs text-gray-400">{items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((incident) => (
                        <button
                          key={incident.ref}
                          type="button"
                          data-incident-ref={incident.ref}
                          onClick={() => focusIncident(incident)}
                          aria-pressed={incident.ref === selectedRef}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bb-blue ${incident.ref === selectedRef
                            ? 'border-bb-blue bg-blue-50 shadow-sm ring-1 ring-bb-blue/40'
                            : 'border-gray-200 bg-white hover:border-bb-blue/70 hover:bg-blue-50/50 hover:shadow-sm'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="block text-[11px] font-semibold text-gray-400">{incident.ref}</span>
                              <span className="block truncate text-sm font-semibold text-gray-900">{incident.classification || incident.title}</span>
                            </div>
                            <Pill color={SEVERITY_PILL_COLOR[incident.severity] || 'gray'} solid>{incident.severity || 'Hindi natukoy'}</Pill>
                          </div>
                          <span className="mt-1 block truncate text-xs text-gray-500">{incident.location || 'Walang nakatalang lokasyon'}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          {mode === 'view' && view === 'pending' && (
            <>
              <h3 className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Naghihintay ng Pag-apruba ({pendingIncidents.length})
              </h3>

              <div ref={listRef} className="space-y-3 scroll-smooth lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                {pendingIncidents.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400">
                    Walang insidenteng naghihintay ng pag-apruba.
                  </p>
                )}
                {pendingIncidents.map((incident) => (
                  <button
                    key={incident.ref}
                    type="button"
                    data-incident-ref={incident.ref}
                    onClick={() => focusIncident(incident)}
                    aria-pressed={incident.ref === selectedRef}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bb-blue ${incident.ref === selectedRef
                      ? 'border-bb-blue bg-blue-50 shadow-sm ring-1 ring-bb-blue/40'
                      : 'border-gray-200 bg-white hover:border-bb-blue/70 hover:bg-blue-50/50 hover:shadow-sm'}`}
                  >
                    <span className="block text-[11px] font-semibold text-gray-400">{incident.ref}</span>
                    <span className="block truncate text-sm font-semibold text-gray-900">{incident.classification || incident.title}</span>
                    <span className="mt-1 block truncate text-xs text-gray-500">{incident.location || 'Walang nakatalang lokasyon'}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          </div>

          <div className={`min-w-0 xl:overflow-y-auto xl:rounded-2xl xl:border xl:border-gray-200 xl:bg-white xl:p-4 xl:shadow-sm ${isFormMode ? 'hidden' : ''}`}>
          {mode === 'view' && !selectedIncident && (
            <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 px-4 py-6 text-center xl:mt-0">
              <h3 className="text-sm font-semibold text-gray-800">Detalye ng insidente</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{visibleIncidents.length > 0
                ? 'Pumili ng insidente sa listahan o i-click ang pin sa mapa para makita ang detalye at mga aksyon.'
                : 'Wala pang insidenteng maipapakita sa napiling view.'}</p>
            </div>
          )}

          {mode === 'view' && selectedIncident && (
            <section className="mt-3 shrink-0 rounded-xl border border-blue-200 bg-blue-50/40 p-3 lg:max-h-[52%] lg:overflow-y-auto xl:mt-0 xl:max-h-none xl:overflow-visible xl:border-0 xl:bg-transparent xl:p-0" aria-label="Detalye ng napiling insidente">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-bb-blue">Napiling insidente · {selectedIncident.ref}</p>
                  <h3 className="mt-0.5 text-sm font-bold text-gray-900">{selectedIncident.title || selectedIncident.classification}</h3>
                </div>
                <Pill color={SEVERITY_PILL_COLOR[selectedIncident.severity] || 'gray'} solid>
                  {selectedIncident.severity || 'Hindi natukoy'}
                </Pill>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">{selectedIncident.excerpt || 'Walang nakatalang buod.'}</p>
              <dl className="mt-3 space-y-2 border-t border-blue-100 pt-3">
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Uri</dt><dd className="mt-0.5 text-sm font-medium text-gray-800">{selectedIncident.classification || 'Hindi natukoy'}</dd></div>
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Lokasyon</dt><dd className="mt-0.5 break-words text-sm font-medium text-gray-800">{selectedIncident.location || 'Hindi nakatala'}</dd></div>
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Petsa at oras</dt><dd className="mt-0.5 text-sm font-medium text-gray-800">{formatDisplayDateTime(selectedIncident.dateISO)}</dd></div>
                <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</dt><dd className="mt-0.5 text-sm font-medium text-gray-800">{getStatusLabel(selectedIncident.status)}</dd></div>
              </dl>
              {((view === 'pending' && canApprove) || (view !== 'pending' && canUpdate)) && <div className="mt-3 flex flex-wrap gap-2 border-t border-blue-100 pt-3">
                {view === 'pending' ? (
                  canApprove && <>
                    <button type="button" onClick={() => requestApprove(selectedIncident)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Aprubahan</button>
                    <button type="button" onClick={() => requestReject(selectedIncident)} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Tanggihan</button>
                  </>
                ) : (
                  <>
                    {canUpdate && <button type="button" onClick={() => requestUnmap(selectedIncident)} className="ml-auto text-xs font-semibold text-amber-800 hover:underline">Alisin sa Mapa</button>}
                  </>
                )}
              </div>}
            </section>
          )}
          </div>

          {isFormMode && (
            <form
              onSubmit={saveForm}
              className="space-y-4 overflow-y-auto rounded-lg border border-bb-blue/40 p-4 lg:min-h-0 lg:flex-1 xl:col-span-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-bb-blue">
                  {mode === 'create' ? 'Bagong Insidente' : `Insidente: ${draft.ref}`}
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
