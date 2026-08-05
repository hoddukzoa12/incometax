declare namespace kakao.maps {
  class LatLng {
    constructor(latitude: number, longitude: number)
    getLat(): number
    getLng(): number
  }

  class LatLngBounds {
    getSouthWest(): LatLng
    getNorthEast(): LatLng
  }

  interface MapOptions {
    readonly center: LatLng
    readonly level: number
  }

  interface LevelOptions {
    readonly animate?: boolean | { readonly duration: number }
    readonly anchor?: LatLng
  }

  class Map {
    constructor(container: HTMLElement, options: MapOptions)
    addControl(control: ZoomControl, position: unknown): void
    getBounds(): LatLngBounds
    getCenter(): LatLng
    getLevel(): number
    relayout(): void
    setCenter(position: LatLng): void
    setLevel(level: number, options?: LevelOptions): void
  }

  interface CustomOverlayOptions {
    readonly clickable?: boolean
    readonly content: HTMLElement
    readonly map?: Map
    readonly position: LatLng
    readonly xAnchor?: number
    readonly yAnchor?: number
    readonly zIndex?: number
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions)
    setMap(map: Map | null): void
  }

  interface MarkerOptions {
    readonly map?: Map
    readonly position: LatLng
    readonly title?: string
  }

  class Marker {
    constructor(options: MarkerOptions)
    setMap(map: Map | null): void
  }

  type ClusterStyle = Readonly<Record<string, string>>

  interface MarkerClustererOptions {
    readonly averageCenter?: boolean
    readonly calculator?: readonly number[]
    readonly gridSize?: number
    readonly map: Map
    readonly styles?: readonly ClusterStyle[]
    readonly texts?: (count: number) => string
  }

  class MarkerClusterer {
    constructor(options: MarkerClustererOptions)
    addMarkers(markers: readonly Marker[]): void
    clear(): void
  }

  class ZoomControl {}

  const ControlPosition: {
    readonly RIGHT: unknown
  }

  function load(callback: () => void): void

  namespace event {
    function addListener(
      target: object,
      eventName: string,
      handler: () => void,
    ): void
    function removeListener(
      target: object,
      eventName: string,
      handler: () => void,
    ): void
    function preventMap(): void
  }
}

interface Window {
  kakao?: typeof kakao
}
