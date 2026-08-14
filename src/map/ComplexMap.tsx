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
import { groupComplexesByPosition } from './group-by-position'
import { createComplexMarkerImage } from './marker-image'
import './map.css'

type MapDisplayMode = 'labels' | 'clusters'

export interface ComplexMapProps {
  readonly onComplexSelect: (complexId: string) => void
  /** 이미 담은 단지. 라벨이 담기/빼기 중 무엇을 보일지 정한다. */
  readonly ownedComplexIds: readonly string[]
  readonly selectedComplexId: string | null
  readonly onAddComplex: (complexId: string) => void
  readonly onRemoveComplex: (complexId: string) => void
  /**
   * 검색으로 고른 단지. 그 자리로 지도를 옮기고 라벨이 보이는 축척까지 당긴다.
   * 같은 단지를 다시 고를 수 있으므로 seq 로 요청을 구분한다.
   */
  readonly focus: { readonly lat: number; readonly lng: number; readonly seq: number } | null
  /** 카카오 주소·장소 검색으로 고른 위치. D1 단지 마커와 별도로 표시한다. */
  readonly addressMarker: {
    readonly lat: number
    readonly lng: number
    readonly title: string
    readonly seq: number
  } | null
}

const displayModeForLevel = (level: number): MapDisplayMode =>
  level <= MAXIMUM_LABEL_DISPLAY_LEVEL ? 'labels' : 'clusters'

/**
 * 고른 단지를 지도 가운데로 옮긴다.
 *
 * 위아래로 밀어 두지 않는다. 데스크톱 패널은 지도와 flex 형제라 덮지 않고,
 * 좁은 화면의 단지 패널은 지도를 통째로 덮으므로 비켜 둘 자리가 따로 없다.
 * 패널을 닫으면 고른 단지가 화면 정중앙에 있어야 한다.
 */
const panToComplex = (
  map: kakao.maps.Map,
  position: { readonly lat: number; readonly lng: number },
): void => {
  map.setCenter(new kakao.maps.LatLng(position.lat, position.lng))
  // 라벨이 보이는 축척까지 당긴다 — 골랐는데 점만 보이면 확인이 안 된다.
  if (map.getLevel() > MAXIMUM_LABEL_DISPLAY_LEVEL) {
    map.setLevel(MAXIMUM_LABEL_DISPLAY_LEVEL, {
      animate: { duration: MAP_LEVEL_CHANGE_ANIMATION_DURATION_MS },
    })
  }
}

const clusterText = (count: number): string =>
  `${count}${MAP_MESSAGES.clusterSuffix}`

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

export default function ComplexMap({
  onComplexSelect,
  ownedComplexIds,
  selectedComplexId,
  onAddComplex,
  onRemoveComplex,
  focus,
  addressMarker,
}: ComplexMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<kakao.maps.Map | null>(null)
  const onComplexSelectRef = useRef(onComplexSelect)
  // 라벨은 kakao 오버레이라 React 밖에서 만들어진다. 최신 상태를 ref 로 건넨다.
  const labelsRef = useRef<ComplexLabel[]>([])
  const labelStateRef = useRef({
    ownedComplexIds,
    selectedComplexId,
    onAddComplex,
    onRemoveComplex,
  })
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>(
    displayModeForLevel(INITIAL_MAP_LEVEL),
  )
  const [complexCount, setComplexCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isTruncated, setIsTruncated] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || focus === null) return
    panToComplex(map, focus)
  }, [focus, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || addressMarker === null) return
    const marker = new kakao.maps.Marker({
      map,
      position: new kakao.maps.LatLng(addressMarker.lat, addressMarker.lng),
      title: addressMarker.title,
      image: createComplexMarkerImage(),
    })
    return () => marker.setMap(null)
  }, [addressMarker, mapReady])

  useEffect(() => {
    onComplexSelectRef.current = onComplexSelect
    labelStateRef.current = {
      ownedComplexIds,
      selectedComplexId,
      onAddComplex,
      onRemoveComplex,
    }
    // ref 를 갱신한 뒤 살아 있는 라벨에 알린다 — 담기/빼기가 바로 보여야 한다.
    for (const label of labelsRef.current) label.refresh()
  }, [
    onComplexSelect,
    ownedComplexIds,
    selectedComplexId,
    onAddComplex,
    onRemoveComplex,
  ])

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
      labelsRef.current = []
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
        labels = groupComplexesByPosition(complexes).map((group) =>
          new ComplexLabel(
            map!,
            group,
            () => ({
              ownedComplexIds: labelStateRef.current.ownedComplexIds,
              selectedComplexId: labelStateRef.current.selectedComplexId,
            }),
            {
              onSelect: (id) => {
                /*
                 * 고른 단지를 가운데로 옮긴다 — 검색으로 왔을 때와 같은 거동이다.
                 * 좁은 화면에서는 바텀시트가 아래를 덮으므로 그만큼 위로 올려
                 * 라벨이 시트 뒤로 숨지 않게 한다.
                 */
                panToComplex(map!, group[0])
                onComplexSelectRef.current(id)
              },
              onAdd: (id) => labelStateRef.current.onAddComplex(id),
              onRemove: (id) => labelStateRef.current.onRemoveComplex(id),
            },
          ),
        )
        labelsRef.current = labels
        return
      }

      clearLabels()
      clearMarkers()
      // 마커 이미지는 한 번만 만들어 모든 마커가 공유한다.
      const markerImage = createComplexMarkerImage()
      markers = complexes.map((complex) => {
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(complex.lat, complex.lng),
          // 마우스를 올리면 어느 단지인지 뜬다. 점만으로는 알 수 없다.
          title: complex.name,
          image: markerImage,
        })
        // 눌러서 사이드바를 여는 것이 이 축척에서 단지를 확인하는 유일한 길이다.
        kakao.maps.event.addListener(marker, 'click', () => {
          /*
           * 라벨·검색과 같은 거동으로 맞춘다. 마커는 라벨이 안 보이는 먼 축척에만
           * 나오므로, 여기서는 가운데로 옮기면서 라벨이 뜨는 데까지 당겨 준다 —
           * 점만 보고 고른 것이 어느 단지인지 그 자리에서 확인된다.
           */
          panToComplex(map!, complex)
          onComplexSelectRef.current(complex.complexId)
        })
        return marker
      })
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
        setMapReady(true)
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
