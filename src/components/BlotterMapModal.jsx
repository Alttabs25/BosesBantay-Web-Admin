import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvent } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Search, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { reverseGeocode, searchAddress } from '../lib/geocode'
import { MilagrosaMapArea, MILAGROSA_CENTER } from './MilagrosaMapArea'
import { useToast } from '../context/ToastContext'

const DEFAULT_CENTER = MILAGROSA_CENTER

function draftIcon() {
  return L.divIcon({
    className: '',
    html: '<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px #17294b55)"><path d="M14 34C11 29 2 22 2 14a12 12 0 0 1 24 0c0 8-9 15-12 20Z" fill="#244ca1" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="4" fill="white"/></svg>',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  })
}

function ClickCapture({ onPick }) {
  useMapEvent('click', (e) => {
    onPick(e.latlng)
  })
  return null
}

function MapController({ onReady, center }) {
  const map = useMap()
  const latitude = center?.[0]
  const longitude = center?.[1]
  useEffect(() => {
    onReady(map)
    const resize = () => map.invalidateSize({ pan: false })
    const observer = new ResizeObserver(resize)
    observer.observe(map.getContainer())
    const timer = setTimeout(() => {
      resize()
      if (latitude != null && longitude != null) map.setView([latitude, longitude], 18, { animate: false })
    }, 200)
    return () => { clearTimeout(timer); observer.disconnect() }
  }, [map, onReady, latitude, longitude])
  return null
}

export default function BlotterMapModal({ open, onClose, report, onSave, correction = false }) {
  const { showToast } = useToast()
  const mapRef = useRef(null)
  const lookupVersion = useRef(0)
  const onMapReady = useCallback(map => { mapRef.current = map }, [])
  const initialPosition = useMemo(() => report?.lat != null && report?.lng != null ? [Number(report.lat), Number(report.lng)] : DEFAULT_CENTER, [report?.lat, report?.lng])
  const markerIcon = useMemo(draftIcon, [])

  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [location, setLocation] = useState('')
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [reason, setReason] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [addressWarning, setAddressWarning] = useState('')

  useEffect(() => {
    if (open && report) {
      const initialLat = report.lat != null ? parseFloat(report.lat) : null
      const initialLng = report.lng != null ? parseFloat(report.lng) : null
      setLat(initialLat)
      setLng(initialLng)
      setLocation(report.location || report.where || report.address || '')
      ++lookupVersion.current
      setIsGeocoding(false)
      setAddressWarning('')
      setAddressQuery('')
      setReason('')
      setReviewing(false)
      setAddressResults([])
    }
    return () => { ++lookupVersion.current }
  }, [open, report])

  // Reverse geocode when coordinates change via click or drag
  const handlePickPosition = async (latlng) => {
    const lookup = ++lookupVersion.current
    setReviewing(false)
    setAddressWarning('')
    setLat(latlng.lat)
    setLng(latlng.lng)
    setIsGeocoding(true)
    try {
      const label = await reverseGeocode(latlng.lat, latlng.lng)
      if (lookup !== lookupVersion.current) return
      if (label) setLocation(label)
      else setAddressWarning('Address lookup unavailable. Check or enter the correct address.')
    } catch {
      if (lookup === lookupVersion.current) setAddressWarning('Address lookup unavailable. Check or enter the correct address.')
    } finally {
      if (lookup === lookupVersion.current) setIsGeocoding(false)
    }
  }

  const handleSearchAddress = async (e) => {
    e?.preventDefault()
    if (!addressQuery.trim()) return
    setIsSearching(true)
    try {
      const results = await searchAddress(addressQuery)
      setAddressResults(results)
    } catch {
      showToast('Nagka-problema sa paghahanap ng address.', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectResult = (result) => {
    ++lookupVersion.current
    setReviewing(false)
    setIsGeocoding(false)
    setAddressWarning('')
    setLat(result.lat)
    setLng(result.lng)
    setLocation(result.label)
    setAddressResults([])
    setAddressQuery('')
    if (mapRef.current) {
      mapRef.current.flyTo([result.lat, result.lng], 17)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSaving || isGeocoding) return
    if (correction && !reason.trim()) return
    if (lat == null || lng == null) {
      showToast('Pumili muna ng lokasyon sa mapa bago i-map ang insidente.', 'error')
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Di-wastong coordinates ng lokasyon.', 'error')
      return
    }

    if (correction && !reviewing) { setReviewing(true); return }
    setIsSaving(true)
    try {
      await onSave({
        lat,
        lng,
        location: location.trim() || 'Quezon City',
        report,
        reason: reason.trim(),
      })
      showToast(correction ? 'Na-save ang corrected location.' : `${report?.id || report?.ref}: Matagumpay na nai-map ang insidente.`)
      onClose()
    } catch (err) {
      console.error('Error saving incident location in BlotterMapModal:', err)
      showToast(err.message || 'Hindi na-save ang lokasyon ng insidente. Pakisubukan muli.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const centerPos = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER

  return (
    <Modal
      open={open}
      onClose={() => { if (!isSaving) onClose() }}
      title={correction ? `Confirm location: ${report?.id}` : report?.is_mapped ? `Baguhin ang Lokasyon: ${report?.id}` : `I-map ang Insidente: ${report?.id}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Click the correct spot or drag the pin. Zoom in for a more precise location.
          </p>

          {/* Search address bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                placeholder="Maghanap ng address o landmark (hal. Quirino Highway)..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchAddress}
              disabled={isSearching || !addressQuery.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Hanapin
            </button>
          </div>

          {addressResults.length > 0 && (
            <ul className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg text-xs z-50">
              {addressResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => handleSelectResult(r)}
                    className="w-full px-3 py-2 text-left hover:bg-bb-blue-light transition-colors flex items-start gap-2 text-gray-700"
                  >
                    <MapPin size={14} className="shrink-0 text-bb-blue mt-0.5" />
                    <span>{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Map view */}
        <div className={`relative ${correction ? "h-80" : "h-64"} w-full overflow-hidden rounded-lg border border-gray-200 shadow-inner`}>
          <MapContainer center={centerPos} zoom={15} className="h-full w-full">
            <MilagrosaMapArea showLabel={!correction} focusPosition={correction ? initialPosition : null} />
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController onReady={onMapReady} center={initialPosition} />
            <ClickCapture onPick={handlePickPosition} />
            {lat != null && lng != null && (
              <Marker
                position={[lat, lng]}
                icon={markerIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const nextLatLng = e.target.getLatLng()
                    handlePickPosition(nextLatLng)
                  },
                }}
              />
            )}
          </MapContainer>

          {lat == null && (
            <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-black/10">
              <span className="rounded-full bg-bb-navy/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow">
                I-click ang mapa upang itakda ang pin
              </span>
            </div>
          )}
        </div>

        {/* Coordinates readout and Location label */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
            <span className="block font-semibold text-gray-400 uppercase text-[10px]">Eksaktong Coordinates</span>
            {lat != null && lng != null ? (
              <span className="font-mono text-gray-800 font-semibold mt-0.5 block">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </span>
            ) : (
              <span className="text-orange-500 font-medium mt-0.5 block">
                Wala pang napiling lokasyon sa mapa.
              </span>
            )}
          </div>

          <div>
            <label className="block">
              <span className="block font-semibold text-gray-400 uppercase text-[10px] mb-1">
                Lokasyon / Address
              </span>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => { ++lookupVersion.current; setIsGeocoding(false); setAddressWarning(''); setLocation(e.target.value); setReviewing(false) }}
                placeholder={isGeocoding ? 'Kinukuha ang address...' : 'hal. Purok 4, Quezon City'}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>
          </div>
        </div>

        {addressWarning && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{addressWarning}</p>}
        {correction && <div><label className="block text-xs font-semibold text-slate-600">Reason for correction<textarea required maxLength={1000} rows={2} value={reason} onChange={event => { setReason(event.target.value); setReviewing(false) }} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" placeholder="Briefly explain why the pin needs to be corrected." /></label><div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick-fill correction reasons">{['Pin does not match the address.', 'Pin is on the wrong street.', 'Exact location confirmed with the resident.'].map(value => <button type="button" key={value} onClick={() => { setReason(value); setReviewing(false) }} aria-pressed={reason === value} className={`rounded-lg border px-2.5 py-2 text-[11px] font-medium ${reason === value ? 'border-blue-300 bg-blue-50 text-bb-blue' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-blue-50'}`}>{value}</button>)}</div></div>}

        {correction && reviewing && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700"><p className="font-semibold">Kumpirmahin ang bagong lokasyon</p><p className="mt-1">{location}</p><p className="mt-1 text-xs tabular-nums">{lat?.toFixed(6)}, {lng?.toFixed(6)}</p><p className="mt-2 text-xs">Mase-save ang bagong pin, dahilan, at staff na nagkumpirma.</p></div>}
        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            Kanselahin
          </button>
          <button
            type="submit"
            disabled={isSaving || isGeocoding || lat == null || lng == null || (correction && !reason.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-bb-blue hover:bg-bb-blue-dark px-5 py-2 text-xs font-semibold text-white shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            <span>{correction ? reviewing ? 'Confirm and save' : 'Review location' : 'I-save ang Lokasyon'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
