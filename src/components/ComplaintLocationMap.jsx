import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MilagrosaMapArea } from './MilagrosaMapArea'

const locationIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;background:#244ca1;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 7px #17294b66"></div>',
  iconSize: [22, 22], iconAnchor: [11, 25],
})

function ContainMapScroll() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const containWheel = event => { event.preventDefault(); event.stopPropagation() }
    container.addEventListener('wheel', containWheel, { passive: false })
    return () => container.removeEventListener('wheel', containWheel)
  }, [map])
  return null
}

export default function ComplaintLocationMap({ latitude, longitude }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  const position = [latitude, longitude]
  return <div className="relative isolate overflow-hidden rounded-lg border border-slate-200" role="region" aria-label="Mapa ng naitalang lokasyon ng reklamo">
    <MapContainer center={position} zoom={18} maxZoom={19} scrollWheelZoom={true} style={{ width: "100%", aspectRatio: "1 / 1" }} className="complaint-square-map">
      <ContainMapScroll />
      <MilagrosaMapArea focusPosition={position} showLabel={false} />
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Marker position={position} icon={locationIcon} draggable={false} keyboard={false} interactive={false} />
    </MapContainer>
    <p className="border-t border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">Naitalang lokasyon · Fixed pin</p>
  </div>
}
