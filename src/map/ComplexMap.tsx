import { useCallback, useEffect, useRef, useState } from 'react'

import type { ComplexSummary } from '../../shared/complex'
import { MAP_MESSAGES } from '../messages/map'
import { ComplexLabel } from './ComplexLabel'
import {
  BOUNDS_REQUEST_DEBOUNCE_MS,
  CLUSTER_CALCULATOR,
  CLUSTER_GRID_SIZE_PX,
  CLUSTER_STYLES,
  COMPLEX_MARKER_CAP,
  INITIAL_MAP_CENTER,
  INITIAL_MAP_LEVEL,
  KAKAO_MINIMUM_MAP_LEVEL,
  MAP_LEVEL_CHANGE_ANIMATION_DURATION_MS,
  MAXIMUM_LABEL_DISPLAY_LEVEL,
} from './constants'
import { fetchComplexes } from './fetchComplexes'
import { loadKakaoMapsSdk } from './loadKakaoMapsSdk'
import './map.css'

type MapDisplayMode = 'labels' | 'clusters'

export interface ComplexMapProps {
  readonly onComplexSelect: (complexId: string) => void
}

const displayModeForLevel = (level: number): MapDisplayMode =>
  level <= MAXIMUM_LABEL_DISPLAY_LEVEL ? 'labels' : 'clusters'

const clusterText = (count: number): string =>
  `${count}${MAP_MESSAGES.clusterSuffix}`

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export default function ComplexMap({ onComplexSelect }: ComplexMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const onComplexSelectRef = useRef(onComplexSelect)
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>(
    displayModeForLevel(INITIAL_MAP_LEVEL),
  )
  const [complexCount, setComplexCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isTruncated, setIsTruncated] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    onComplexSelectRef.current = onComplexSelect
  }, [onComplexSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let requestTimeout: ReturnType<typeof setTimeout> | undefined
    let activeRequest: AbortController | undefined
    let labels: ComplexLabel[] = []
    let complexes: readonly ComplexSummary[] = []
    let markers: kakao.maps.Marker[] = []
    let currentDisplayMode = displayModeForLevel(INITIAL_MAP_LEVEL)
    let resizeObserver: ResizeObserver | undefined
    let clusterer: kakao.maps.MarkerClusterer | undefined
    let map: kakao.maps.Map | undefined

    const clearLabels = (): void => {
      labels.forEach((label) => label.dispose())
      labels = []
    }

    const clearMarkers = (): void => {
      clusterer?.clear()
      markers.forEach((marker) => marker.setMap(null))
      markers = []
    }

    const renderComplexes = (): void => {
      if (!map || !clusterer) return
      const nextDisplayMode = displayModeForLevel(map.getLevel())
      currentDisplayMode = nextDisplayMode
      setDisplayMode(nextDisplayMode)

      if (nextDisplayMode === 'labels') {
        clearMarkers()
        clearLabels()
        labels = complexes.map(
          (complex) =>
            new ComplexLabel(map!, complex, (complexId) => {
              onComplexSelectRef.current(complexId)
            }),
        )
        return
      }

      clearLabels()
      clearMarkers()
      markers = complexes.map(
        (complex) =>
          new kakao.maps.Marker({
            position: new kakao.maps.LatLng(complex.lat, complex.lng),
            title: complex.name,
          }),
      )
      clusterer.addMarkers(markers)
    }

    const loadBounds = async (): Promise<void> => {
      if (!map) return
      activeRequest?.abort()
      activeRequest = new AbortController()
      const request = activeRequest
      const bounds = map.getBounds()
      const southWest = bounds.getSouthWest()
      const northEast = bounds.getNorthEast()

      setIsLoading(true)
      setLoadError(null)
      try {
        const response = await fetchComplexes(
          {
            south: southWest.getLat(),
            west: southWest.getLng(),
            north: northEast.getLat(),
            east: northEast.getLng(),
          },
          request.signal,
        )
        if (cancelled || request !== activeRequest) return
        complexes = response.items.slice(0, COMPLEX_MARKER_CAP)
        setComplexCount(complexes.length)
        setIsTruncated(response.truncated)
        renderComplexes()
      } catch (error) {
        if (cancelled || isAbortError(error)) return
        setLoadError(MAP_MESSAGES.loadError)
      } finally {
        if (!cancelled && request === activeRequest) setIsLoading(false)
      }
    }

    const scheduleBoundsLoad = (): void => {
      if (requestTimeout) clearTimeout(requestTimeout)
      requestTimeout = setTimeout(() => {
        void loadBounds()
      }, BOUNDS_REQUEST_DEBOUNCE_MS)
    }

    const handleZoomChanged = (): void => {
      if (!map) return
      const nextDisplayMode = displayModeForLevel(map.getLevel())
      if (nextDisplayMode !== currentDisplayMode) renderComplexes()
    }

    void loadKakaoMapsSdk(import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY)
      .then(() => {
        if (cancelled) return
        map = new kakao.maps.Map(container, {
          center: new kakao.maps.LatLng(
            INITIAL_MAP_CENTER.latitude,
            INITIAL_MAP_CENTER.longitude,
          ),
          level: INITIAL_MAP_LEVEL,
        })
        mapRef.current = map
        map.addControl(
          new kakao.maps.ZoomControl(),
          kakao.maps.ControlPosition.RIGHT,
        )
        clusterer = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          calculator: [...CLUSTER_CALCULATOR],
          gridSize: CLUSTER_GRID_SIZE_PX,
          texts: clusterText,
          styles: CLUSTER_STYLES.map((style) => ({ ...style })),
        })

        kakao.maps.event.addListener(map, 'idle', scheduleBoundsLoad)
        kakao.maps.event.addListener(map, 'zoom_changed', handleZoomChanged)

        resizeObserver = new ResizeObserver(() => {
          if (!map) return
          const center = map.getCenter()
          map.relayout()
          map.setCenter(center)
        })
        resizeObserver.observe(container)
        scheduleBoundsLoad()
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setIsLoading(false)
        setLoadError(error instanceof Error ? error.message : MAP_MESSAGES.loadError)
      })

    return () => {
      cancelled = true
      if (requestTimeout) clearTimeout(requestTimeout)
      activeRequest?.abort()
      resizeObserver?.disconnect()
      if (map) {
        kakao.maps.event.removeListener(map, 'idle', scheduleBoundsLoad)
        kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomChanged)
      }
      clearLabels()
      clearMarkers()
      mapRef.current = null
    }
  }, [])

  const handleZoomIn = useCallback((): void => {
    const map = mapRef.current
    if (!map) return
    const nextLevel = Math.max(KAKAO_MINIMUM_MAP_LEVEL, map.getLevel() - 1)
    map.setLevel(nextLevel, {
      animate: { duration: MAP_LEVEL_CHANGE_ANIMATION_DURATION_MS },
    })
  }, [])

  return (
    <section
      className="complex-map"
      aria-label={MAP_MESSAGES.mapLabel}
      data-complex-count={complexCount}
      data-display-mode={displayMode}
    >
      <div ref={containerRef} className="complex-map__canvas" />
      {isLoading && (
        <div className="complex-map__status" role="status">
          {MAP_MESSAGES.loading}
        </div>
      )}
      {loadError && (
        <div className="complex-map__status complex-map__status--error" role="alert">
          {loadError}
        </div>
      )}
      {isTruncated && (
        <div className="complex-map__truncated" role="status">
          <span>{MAP_MESSAGES.truncated}</span>
          <button type="button" onClick={handleZoomIn}>
            {MAP_MESSAGES.zoomIn}
          </button>
        </div>
      )}
    </section>
  )
}
