import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ExternalLink, Images, LoaderCircle, X, ZoomIn, ZoomOut } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const SIGNED_URL_TTL_SECONDS = 60 * 60
const EMPTY_PATHS = []

function isDirectUrl(value) {
  return /^(https?:|blob:|data:)/i.test(value)
}

export default function ReportEvidenceGallery({ paths = EMPTY_PATHS, reportId, compact = false }) {
  const uniquePaths = useMemo(
    () => [...new Set(paths.filter((path) => typeof path === 'string' && path.trim()).map((path) => path.trim()))],
    [paths]
  )
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(uniquePaths.length > 0)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [retry, setRetry] = useState(0)
  const touchStartX = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadPhotos() {
      if (uniquePaths.length === 0) {
        setPhotos([])
        setLoading(false)
        setError('')
        return
      }

      setLoading(true)
      setError('')
      setPhotos([])
      setActiveIndex(null)

      const resolved = await Promise.allSettled(
        uniquePaths.map(async (path) => {
          let objectPath = path.replace(/^\/?report_evidence\//, '')
          if (isDirectUrl(path)) {
            const url = new URL(path)
            const project = new URL(import.meta.env.VITE_SUPABASE_URL)
            const match = url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/report_evidence\/(.+)$/)
            if (url.origin !== project.origin || !match) return { path, url: path }
            objectPath = decodeURIComponent(match[1])
          }

          const { data, error: signedUrlError } = await supabase.storage
            .from('report_evidence')
            .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS)

          if (signedUrlError || !data?.signedUrl) {
            console.warn('[report-photos] Unable to authorize attachment', { reportId, status: signedUrlError?.status || signedUrlError?.statusCode, message: signedUrlError?.message })
            throw signedUrlError || new Error('Missing signed photo URL')
          }
          return { path, url: data.signedUrl }
        })
      )

      if (cancelled) return
      const availablePhotos = resolved.filter(result => result.status === 'fulfilled').map(result => result.value)
      setPhotos(availablePhotos)
      setLoading(false)
      if (availablePhotos.length < uniquePaths.length) {
        setError(availablePhotos.length ? 'May ilang larawang hindi ma-load. Subukan muli.' : 'Hindi ma-load ang mga larawan. Maaaring walang access ang account o hindi na available ang file.')
      }
    }

    loadPhotos().catch(() => {
      if (cancelled) return
      setPhotos([])
      setLoading(false)
      setError('Hindi mabuksan ang mga kalakip na larawan.')
    })

    return () => {
      cancelled = true
    }
  }, [uniquePaths, reportId, retry])

  useEffect(() => {
    if (activeIndex === null) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') setActiveIndex(null)
      if (event.key === 'ArrowLeft' && photos.length > 1) {
        setActiveIndex((current) => (current === null ? 0 : (current - 1 + photos.length) % photos.length))
      }
      if (event.key === 'ArrowRight' && photos.length > 1) {
        setActiveIndex((current) => (current === null ? 0 : (current + 1) % photos.length))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [activeIndex, photos.length])

  useEffect(() => {
    setZoom(1)
  }, [activeIndex])

  function closeViewer() {
    setActiveIndex(null)
  }

  function showPrevious() {
    if (photos.length < 2) return
    setActiveIndex((current) => (current === null ? 0 : (current - 1 + photos.length) % photos.length))
  }

  function showNext() {
    if (photos.length < 2) return
    setActiveIndex((current) => (current === null ? 0 : (current + 1) % photos.length))
  }

  function changeZoom(amount) {
    setZoom((current) => Math.min(4, Math.max(1, Number((current + amount).toFixed(1)))))
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null || zoom > 1) return
    const endX = event.changedTouches?.[0]?.clientX
    if (typeof endX !== 'number') return
    const distance = endX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(distance) < 50) return
    if (distance > 0) showPrevious()
    else showNext()
  }

  if (uniquePaths.length === 0) return null

  const activePhoto = activeIndex === null ? null : photos[activeIndex]

  return (
    <section className={compact ? "pb-1" : "border-t border-gray-100 px-4 pb-4 pt-1"} aria-label="Mga kalakip na larawan">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Images size={16} className="text-bb-blue" />
          Mga Larawan
          <span className="rounded-full bg-bb-blue-light px-2 py-0.5 text-[11px] font-bold text-bb-blue">
            {uniquePaths.length}
          </span>
        </h4>
        <span className="text-xs text-gray-400">Pindutin ang larawan para palakihin</span>
      </div>

      {loading && (
        <div className="flex min-h-28 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500">
          <LoaderCircle size={18} className="mr-2 animate-spin text-bb-blue" />
          Binubuksan ang mga larawan...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
          <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 rounded px-2 py-1 font-semibold underline">Subukan muli</button>
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div className={compact ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"}>
          {photos.map((photo, index) => (
            <button
              key={photo.path}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 bg-gray-100 shadow-xs transition hover:border-bb-blue hover:shadow-md focus:outline-none focus:ring-2 focus:ring-bb-blue focus:ring-offset-2"
              aria-label={`Tingnan ang larawan ${index + 1} ng ${photos.length}`}
            >
              <img
                src={photo.url}
                alt={`Kalakip na larawan ${index + 1} ng report ${reportId}`}
                className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                onError={() => setError('May larawang hindi ma-load. Subukan muli para kumuha ng bagong access link.')}
              />
              <span className="absolute bottom-2 right-2 rounded-md bg-gray-950/70 px-2 py-1 text-[10px] font-semibold text-white">
                {index + 1} / {photos.length}
              </span>
            </button>
          ))}
        </div>
      )}

      {activePhoto && createPortal(
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-gray-950/95"
          role="dialog"
          aria-modal="true"
          aria-label={`Larawan ${activeIndex + 1} ng ${photos.length}`}
          onClick={closeViewer}
        >
          <div className="z-10 flex items-center justify-between px-4 py-3 text-white sm:px-6">
            <div>
              <p className="text-sm font-semibold">Larawan {activeIndex + 1} ng {photos.length}</p>
              <p className="text-xs text-white/60">Report {reportId}</p>
            </div>
            <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => changeZoom(-0.5)} disabled={zoom <= 1} className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 disabled:opacity-30" aria-label="Paliitin ang larawan">
                <ZoomOut size={19} />
              </button>
              <span className="min-w-12 text-center text-xs font-semibold text-white/80">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => changeZoom(0.5)} disabled={zoom >= 4} className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20 disabled:opacity-30" aria-label="Palakihin ang larawan">
                <ZoomIn size={19} />
              </button>
              <a href={activePhoto.url} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20" aria-label="Buksan ang orihinal na larawan sa bagong tab">
                <ExternalLink size={19} />
              </a>
              <button type="button" onClick={closeViewer} className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20" aria-label="Isara ang viewer">
                <X size={21} />
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-14 py-3"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => {
              touchStartX.current = event.touches?.[0]?.clientX ?? null
            }}
            onTouchEnd={handleTouchEnd}
            onWheel={(event) => {
              if (!event.ctrlKey) return
              event.preventDefault()
              changeZoom(event.deltaY < 0 ? 0.25 : -0.25)
            }}
          >
            {photos.length > 1 && (
              <>
                <button type="button" onClick={showPrevious} className="fixed left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-6" aria-label="Nakaraang larawan">
                  <ChevronLeft size={26} />
                </button>
                <button type="button" onClick={showNext} className="fixed right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-6" aria-label="Susunod na larawan">
                  <ChevronRight size={26} />
                </button>
              </>
            )}
            <img
              src={activePhoto.url}
              alt={`Pinalaking larawan ${activeIndex + 1} ng report ${reportId}`}
              onDoubleClick={() => setZoom((current) => (current > 1 ? 1 : 2))}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
              style={{ transform: `scale(${zoom})`, cursor: zoom > 1 ? 'zoom-out' : 'zoom-in' }}
              draggable="false"
            />
          </div>

          {photos.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3" onClick={(event) => event.stopPropagation()}>
              {photos.map((photo, index) => (
                <button
                  key={photo.path}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${index === activeIndex ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
                  aria-label={`Buksan ang larawan ${index + 1}`}
                >
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </section>
  )
}
