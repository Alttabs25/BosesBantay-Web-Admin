import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvent } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Search, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { reverseGeocode, searchAddress } from '../lib/geocode'
import { useToast } from '../context/ToastContext'

const DEFAULT_CENTER = [14.6768, 121.0453]

function draftIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="background:#0b3d66;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
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
  useEffect(() => {
    onReady?.(map)
    const timer = setTimeout(() => {
      map.invalidateSize()
      if (center && center[0] != null && center[1] != null) {
        map.setView(center, Math.max(map.getZoom(), 16))
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [map, onReady, center])
  return null
}

export default function BlotterMapModal({ open, onClose, report, onSave }) {
  const { showToast } = useToast()
  const mapRef = useRef(null)

  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [location, setLocation] = useState('')
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open && report) {
      const initialLat = report.lat != null ? parseFloat(report.lat) : null
      const initialLng = report.lng != null ? parseFloat(report.lng) : null
      setLat(initialLat)
      setLng(initialLng)
      setLocation(report.location || report.where || report.address || '')
      setAddressQuery('')
      setAddressResults([])
    }
  }, [open, report])

  // Reverse geocode when coordinates change via click or drag
  const handlePickPosition = async (latlng) => {
    setLat(latlng.lat)
    setLng(latlng.lng)
    setIsGeocoding(true)
    try {
      const label = await reverseGeocode(latlng.lat, latlng.lng)
      if (label) setLocation(label)
    } catch {
      // Keep existing location if reverse geocoding fails
    } finally {
      setIsGeocoding(false)
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
    if (lat == null || lng == null) {
      showToast('Pumili muna ng lokasyon sa mapa bago i-map ang insidente.', 'error')
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('Di-wastong coordinates ng lokasyon.', 'error')
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        lat,
        lng,
        location: location.trim() || 'Quezon City',
      })
      showToast(`${report?.id}: Matagumpay na nai-map ang insidente.`)
      onClose()
    } catch (err) {
      showToast(err.message || 'Hindi na-save ang lokasyon.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const centerPos = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={report?.is_mapped ? `Baguhin ang Lokasyon: ${report?.id}` : `I-map ang Insidente: ${report?.id}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-2">
            I-click ang mapa upang itakda o i-drag ang pin sa eksaktong lokasyon ng insidente. Maaari ring mag-search ng address sa ibaba.
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
        <div className="relative h-64 w-full overflow-hidden rounded-lg border border-gray-200 shadow-inner">
          <MapContainer center={centerPos} zoom={15} className="h-full w-full">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController onReady={(map) => (mapRef.current = map)} center={centerPos} />
            <ClickCapture onPick={handlePickPosition} />
            {lat != null && lng != null && (
              <Marker
                position={[lat, lng]}
                icon={draftIcon()}
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
                onChange={(e) => setLocation(e.target.value)}
                placeholder={isGeocoding ? 'Kinukuha ang address...' : 'hal. Purok 4, Quezon City'}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </label>
          </div>
        </div>

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
            disabled={isSaving || lat == null || lng == null}
            className="flex items-center gap-1.5 rounded-lg bg-bb-blue hover:bg-bb-blue-dark px-5 py-2 text-xs font-semibold text-white shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            <span>I-save ang Lokasyon</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
