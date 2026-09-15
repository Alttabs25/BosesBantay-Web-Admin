import { useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvent } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Search, Loader2, CheckCircle2, CircleDot, AlertCircle } from 'lucide-react'
import Modal from './Modal'
import { reverseGeocode, searchAddress } from '../lib/geocode'
import { useToast } from '../context/ToastContext'

const DEFAULT_CENTER = [14.6768, 121.0453]

const CLASSIFICATION_OPTIONS = [
  'Kaganapan',
  'Ingay',
  'Away ng Kapitbahay',
  'Vandalism',
  'Public Dispute',
  'Damaged Facility',
  'Other Hazard',
  'Krimen / Nakawan',
]

const SECTOR_OPTIONS = ['Sector 1', 'Sector 2', 'Sector 3']
const SEVERITY_OPTIONS = ['Mababa', 'Katamtaman', 'Mataas']

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
  useState(() => {
    onReady?.(map)
    const timer = setTimeout(() => {
      map.invalidateSize()
      if (center) map.setView(center, Math.max(map.getZoom(), 15))
    }, 200)
    return () => clearTimeout(timer)
  })
  return null
}

export default function BlotterCreateModal({ open, onClose, onCreated }) {
  const { showToast } = useToast()
  const mapRef = useRef(null)

  // Incident basic info
  const [title, setTitle] = useState('')
  const [classification, setClassification] = useState('Kaganapan')
  const [severity, setSeverity] = useState('Katamtaman')
  const [sector, setSector] = useState('Sector 1')
  const [dateLocal, setDateLocal] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })

  // Complainant info
  const [filedBy, setFiledBy] = useState('')
  const [complainantPhone, setComplainantPhone] = useState('')
  const [complainantAddress, setComplainantAddress] = useState('')
  const [complainantGender, setComplainantGender] = useState('N/A')
  const [complainantAge, setComplainantAge] = useState('')
  const [isMinor, setIsMinor] = useState(false)

  // 5W1H details
  const [who, setWho] = useState('')
  const [whereText, setWhereText] = useState('')
  const [why, setWhy] = useState('')
  const [how, setHow] = useState('')

  // GIS Mapping Option: 'map' (Option A) vs 'no_map' (Option B)
  const [gisOption, setGisOption] = useState('map') // 'map' | 'no_map'
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [mapLocation, setMapLocation] = useState('')
  const [addressQuery, setAddressQuery] = useState('')
  const [addressResults, setAddressResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePickPosition = async (latlng) => {
    setLat(latlng.lat)
    setLng(latlng.lng)
    setIsGeocoding(true)
    try {
      const label = await reverseGeocode(latlng.lat, latlng.lng)
      if (label) {
        setMapLocation(label)
        if (!whereText.trim()) setWhereText(label)
      }
    } catch {
      // ignore
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

  const handleSelectAddressResult = (result) => {
    setLat(result.lat)
    setLng(result.lng)
    setMapLocation(result.label)
    if (!whereText.trim()) setWhereText(result.label)
    setAddressResults([])
    setAddressQuery('')
    if (mapRef.current) {
      mapRef.current.flyTo([result.lat, result.lng], 17)
    }
  }

  const handleAgeChange = (val) => {
    setComplainantAge(val)
    const num = parseInt(val, 10)
    if (!isNaN(num)) {
      setIsMinor(num < 18)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const finalTitle = title.trim() || classification
    if (!finalTitle) {
      showToast('Ilagay ang pamagat o klasipikasyon ng insidente.', 'error')
      return
    }

    // Validation for Option A
    if (gisOption === 'map') {
      if (lat == null || lng == null) {
        showToast('Pumili muna ng lokasyon sa mapa bago i-map ang insidente.', 'error')
        return
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showToast('Di-wastong coordinates ng lokasyon.', 'error')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const finalLocation = (gisOption === 'map' ? mapLocation : '') || whereText || complainantAddress || 'Quezon City'

      await onCreated({
        title: finalTitle,
        classification,
        severity,
        sector,
        status: gisOption === 'map' ? 'Inimbestigahan' : 'Sinuri',
        dateISO: new Date(dateLocal).toISOString(),
        filedBy: filedBy.trim() || 'Residente',
        complainantPhone: complainantPhone.trim() || 'N/A',
        complainantAddress: complainantAddress.trim() || 'N/A',
        complainantGender,
        complainantAge: complainantAge || '',
        isMinor,
        what: finalTitle,
        who: who.trim() || 'Hindi Alam',
        where: finalLocation,
        location: finalLocation,
        address: finalLocation,
        when: dateLocal,
        why: why.trim() || 'N/A',
        how: how.trim() || 'Naiulat sa barangay.',
        excerpt: how.trim() || finalTitle,
        isMapped: gisOption === 'map',
        lat: gisOption === 'map' ? lat : null,
        lng: gisOption === 'map' ? lng : null,
      })

      showToast(
        gisOption === 'map'
          ? 'Nalikha ang blotter report at matagumpay na nai-map sa GIS.'
          : 'Nalikha ang blotter report (Hindi naka-mapa).'
      )
      onClose()
    } catch (err) {
      showToast(err.message || 'Hindi nai-save ang blotter report.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const mapCenter = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER

  return (
    <Modal open={open} onClose={onClose} title="Bagong Blotter Report / Insidente" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        {/* Section 1: Pangunahing Impormasyon */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-bb-blue border-b border-gray-100 pb-1 mb-3">
            1. Pangunahing Impormasyon (Basic Incident Info)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block mb-1 font-semibold text-gray-700">
                Pamagat ng Insidente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="hal. Maingay na videoke sa dis-oras ng gabi"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Klasipikasyon</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {CLASSIFICATION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Kalubhaan (Severity)</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Sektor ng Barangay</label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                {SECTOR_OPTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Petsa at Oras ng Pangyayari</label>
              <input
                type="datetime-local"
                required
                value={dateLocal}
                onChange={(e) => setDateLocal(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Nagrereklamo (Complainant) */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-bb-blue border-b border-gray-100 pb-1 mb-3">
            2. Nagrereklamo (Complainant Information)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block mb-1 font-semibold text-gray-700">Pangalan ng Nag-report</label>
              <input
                type="text"
                value={filedBy}
                onChange={(e) => setFiledBy(e.target.value)}
                placeholder="hal. Juan Dela Cruz (o 'Residente')"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Contact Number</label>
              <input
                type="text"
                value={complainantPhone}
                onChange={(e) => setComplainantPhone(e.target.value)}
                placeholder="0917-000-0000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Kasarian</label>
              <select
                value={complainantGender}
                onChange={(e) => setComplainantGender(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              >
                <option value="N/A">N/A</option>
                <option value="Lalaki">Lalaki</option>
                <option value="Babae">Babae</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Edad</label>
              <input
                type="number"
                min="1"
                max="120"
                value={complainantAge}
                onChange={(e) => handleAgeChange(e.target.value)}
                placeholder="hal. 28"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block mb-1 font-semibold text-gray-700">Tirahan ng Nagrereklamo</label>
              <input
                type="text"
                value={complainantAddress}
                onChange={(e) => setComplainantAddress(e.target.value)}
                placeholder="hal. 123 Rizal St., Barangay San Jose"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>
          </div>
        </div>

        {/* Section 3: 5W1H & Salaysay */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-bb-blue border-b border-gray-100 pb-1 mb-3">
            3. Mga Detalye ng Insidente (5W1H)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block mb-1 font-semibold text-gray-700">Inirereklamo / Kasangkot (Who)</label>
              <input
                type="text"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="hal. Kapitbahay, Hindi kilalang indibidwal"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700">Lugar ng Pangyayari (Where)</label>
              <input
                type="text"
                value={whereText}
                onChange={(e) => setWhereText(e.target.value)}
                placeholder="hal. Tapat ng tindahan, Kanto ng JP Rizal"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block mb-1 font-semibold text-gray-700">Dahilan / Motibo (Why)</label>
              <input
                type="text"
                value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="hal. Inuman na nauwi sa sigawan, alitan sa bakod"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block mb-1 font-semibold text-gray-700">Buod / Salaysay ng Pangyayari (How)</label>
              <textarea
                rows={3}
                required
                value={how}
                onChange={(e) => setHow(e.target.value)}
                placeholder="Ilarawan nang malinaw ang buong pangyayari..."
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Lokasyon / GIS Mapping */}
        <div className="rounded-xl border-2 border-bb-blue/30 bg-blue-50/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-bb-blue flex items-center gap-1.5">
              <MapPin size={16} />
              Lokasyon / GIS Mapping
            </h4>
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              Pumili ng Pag-mapa
            </span>
          </div>

          <p className="text-xs text-gray-600 mb-3">
            Piliin kung nais na agad i-display ang insidenteng ito bilang marker sa <strong>GIS Command Center map</strong> o itala muna bilang unmapped blotter report.
          </p>

          {/* Option A & Option B Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <button
              type="button"
              onClick={() => setGisOption('map')}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                gisOption === 'map'
                  ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {gisOption === 'map' ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <CircleDot size={18} className="text-gray-400" />
                )}
              </div>
              <div>
                <span className="font-bold text-xs text-gray-900 block">
                  Option A — I-map ang insidente
                </span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  Magtakda ng pin sa mapa. Magiging <strong>Naka-mapa na</strong> at agad lilitaw sa GIS Command Center.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setGisOption('no_map')}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                gisOption === 'no_map'
                  ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {gisOption === 'no_map' ? (
                  <CheckCircle2 size={18} className="text-bb-blue" />
                ) : (
                  <CircleDot size={18} className="text-gray-400" />
                )}
              </div>
              <div>
                <span className="font-bold text-xs text-gray-900 block">
                  Option B — Huwag muna i-map
                </span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  I-save nang walang GIS coordinates. Magiging <strong>Hindi naka-mapa</strong> at maaaring i-map sa ibang pagkakataon.
                </span>
              </div>
            </button>
          </div>

          {/* Option A Map Controls */}
          {gisOption === 'map' && (
            <div className="space-y-3 pt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  placeholder="Hanapin ang address o landmark sa mapa..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-bb-blue focus:outline-none focus:ring-1 focus:ring-bb-blue"
                />
                <button
                  type="button"
                  onClick={handleSearchAddress}
                  disabled={isSearching || !addressQuery.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Hanapin
                </button>
              </div>

              {addressResults.length > 0 && (
                <ul className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-md text-xs">
                  {addressResults.map((r, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => handleSelectAddressResult(r)}
                        className="w-full px-3 py-1.5 text-left hover:bg-bb-blue-light transition-colors text-gray-700 flex items-center gap-2"
                      >
                        <MapPin size={12} className="text-bb-blue shrink-0" />
                        <span>{r.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Leaflet map for Option A */}
              <div className="relative h-56 w-full overflow-hidden rounded-lg border border-gray-300">
                <MapContainer center={mapCenter} zoom={15} className="h-full w-full">
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapController onReady={(map) => (mapRef.current = map)} center={mapCenter} />
                  <ClickCapture onPick={handlePickPosition} />
                  {lat != null && lng != null && (
                    <Marker
                      position={[lat, lng]}
                      icon={draftIcon()}
                      draggable
                      eventHandlers={{
                        dragend: (e) => handlePickPosition(e.target.getLatLng()),
                      }}
                    />
                  )}
                </MapContainer>

                {lat == null && (
                  <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-black/10">
                    <span className="rounded-full bg-bb-navy/90 px-3 py-1 text-xs font-semibold text-white shadow">
                      I-click kahit saan sa mapa upang maglagay ng pin
                    </span>
                  </div>
                )}
              </div>

              {/* Coordinates and reverse geocoded address display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white border border-gray-200 p-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Latitude & Longitude</span>
                  {lat != null && lng != null ? (
                    <span className="font-mono text-emerald-700 font-bold block mt-0.5">
                      {lat.toFixed(6)}, {lng.toFixed(6)}
                    </span>
                  ) : (
                    <span className="text-orange-500 font-medium block mt-0.5 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Wala pang napiling lokasyon sa mapa.
                    </span>
                  )}
                </div>

                <div className="rounded-lg bg-white border border-gray-200 p-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block">Natukoy na Address</span>
                  <input
                    type="text"
                    value={mapLocation}
                    onChange={(e) => setMapLocation(e.target.value)}
                    placeholder={isGeocoding ? 'Kinukuha ang address...' : 'Address sa mapa'}
                    className="w-full text-xs text-gray-800 border-b border-gray-200 focus:outline-none focus:border-bb-blue mt-0.5"
                  />
                </div>
              </div>
            </div>
          )}

          {gisOption === 'no_map' && (
            <div className="rounded-lg bg-white border border-gray-200 p-3 text-xs text-gray-500">
              <span className="font-semibold text-gray-700 block mb-0.5">Naka-set sa Hindi Naka-mapa</span>
              Ang report na ito ay itatala sa digital ledger nang walang GIS marker. Maaari itong i-map anumang oras gamit ang action na &quot;I-map ang insidente&quot;.
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            Kanselahin
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-bb-blue hover:bg-bb-blue-dark px-5 py-2 text-xs font-semibold text-white shadow-xs hover:shadow transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Sine-save...</span>
              </>
            ) : (
              <span>I-save ang Blotter Report</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
