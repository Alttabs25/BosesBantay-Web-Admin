// Web Mercator metres/pixel. Scale both kernel and soft edge with geography.
export function heatmapZoomOptions(zoom, latitude) {
  const metresPerPixel = 156543.03392804097 * Math.cos(latitude * Math.PI / 180) / 2 ** zoom
  return {
    radius: Math.max(1, 18 / metresPerPixel),
    blur: Math.max(1, 10 / metresPerPixel),
    // Leaflet.heat otherwise attenuates every point as the user zooms out.
    maxZoom: zoom,
  }
}
