import { useEffect } from 'react'
import { Polygon, useMap } from 'react-leaflet'
import { MILAGROSA_BOUNDARY, MILAGROSA_BOUNDS } from '../lib/milagrosaBoundary'

// Keep a little surrounding context visible while keeping Milagrosa in focus.
const paddedBounds = [
  [MILAGROSA_BOUNDS[0][0] - 0.003, MILAGROSA_BOUNDS[0][1] - 0.003],
  [MILAGROSA_BOUNDS[1][0] + 0.003, MILAGROSA_BOUNDS[1][1] + 0.003],
]

export const MILAGROSA_CENTER = [
  (MILAGROSA_BOUNDS[0][0] + MILAGROSA_BOUNDS[1][0]) / 2,
  (MILAGROSA_BOUNDS[0][1] + MILAGROSA_BOUNDS[1][1]) / 2,
]

function focusMilagrosa(map, animate = false) {
  map.fitBounds(MILAGROSA_BOUNDS, { padding: [24, 24], animate, duration: 0.25 })
  map.setZoom(map.getZoom() + 1, { animate })
}

export function MilagrosaMapArea() {
  const map = useMap()

  useEffect(() => {
    map.setMaxBounds(paddedBounds)
    map.options.maxBoundsViscosity = 1
    focusMilagrosa(map)
    // Modals can mount before their final size is known.
    const timer = window.setTimeout(() => {
      map.invalidateSize()
      focusMilagrosa(map)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [map])

  useEffect(() => {
    const container = map.getContainer()
    container.classList.add('bb-milagrosa-map')
    map.zoomControl?.setPosition('bottomright')

    const label = document.createElement('div')
    label.className = 'bb-map-area-label'
    label.innerHTML = '<span aria-hidden="true"></span>Barangay Milagrosa'
    container.appendChild(label)

    const recenter = document.createElement('button')
    recenter.type = 'button'
    recenter.className = 'bb-map-recenter'
    recenter.setAttribute('aria-label', 'Ibalik sa saklaw ng Barangay Milagrosa')
    recenter.title = 'Ibalik sa Barangay Milagrosa'
    recenter.innerHTML = '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'
    recenter.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      map.stop()
      focusMilagrosa(map, true)
    })
    container.appendChild(recenter)

    return () => {
      label.remove()
      recenter.remove()
      container.classList.remove('bb-milagrosa-map')
    }
  }, [map])

  useEffect(() => {
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '450',
      pointerEvents: 'none',
      background: 'rgba(244, 248, 252, 0.08)',
      backdropFilter: 'blur(1.5px)',
      WebkitBackdropFilter: 'blur(1.5px)',
    })
    map.getContainer().appendChild(overlay)

    let frame = 0
    const updateMask = () => {
      frame = 0
      const { x: width, y: height } = map.getSize()
      if (!width || !height) return
      const points = MILAGROSA_BOUNDARY.map(([lat, lng]) => {
        const { x, y } = map.latLngToContainerPoint([lat, lng])
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
      // Keep a generous clear buffer for full street names and address labels.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><mask id="area"><rect width="100%" height="100%" fill="white"/><polygon points="${points}" fill="black" stroke="black" stroke-width="180" stroke-linejoin="round"/></mask><rect width="100%" height="100%" fill="white" mask="url(#area)"/></svg>`
      const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
      overlay.style.maskImage = mask
      overlay.style.webkitMaskImage = mask
      overlay.style.maskSize = '100% 100%'
      overlay.style.webkitMaskSize = '100% 100%'
    }
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateMask)
    }
    map.on('move zoom resize', scheduleUpdate)
    updateMask()
    return () => {
      map.off('move zoom resize', scheduleUpdate)
      if (frame) window.cancelAnimationFrame(frame)
      overlay.remove()
    }
  }, [map])

  return (
    <Polygon
      positions={MILAGROSA_BOUNDARY}
      pathOptions={{ color: '#174cbb', weight: 3, opacity: 1, fillColor: '#2d73dc', fillOpacity: 0.16, interactive: false }}
    />
  )
}
