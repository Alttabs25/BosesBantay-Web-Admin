import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { MilagrosaMapArea } from './MilagrosaMapArea'

const locationIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;background:#244ca1;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 7px #17294b66"></div>',
  iconSize: [22, 22], iconAnchor: [11, 25],
})

export default function ComplaintLocationMap({ latitude, longitude }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  const position = [latitude, longitude]
  return <div className="relative mt-4 isolate overflow-hidden rounded-lg border border-slate-200" role="region" aria-label="Mapa ng naitalang lokasyon ng reklamo">
    <MapContainer center={position} zoom={18} maxZoom={19} scrollWheelZoom={false} className="h-[340px] w-full">
      <MilagrosaMapArea focusPosition={position} />
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Marker position={position} icon={locationIcon} draggable={false} keyboard={false} interactive={false} />
    </MapContainer>
    <p className="border-t border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">Naitalang lokasyon · Fixed pin</p>
  </div>
}
