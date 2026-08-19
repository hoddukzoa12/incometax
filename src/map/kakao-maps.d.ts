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
    /** 지도를 담은 DOM 요소. 보이는 영역 크기를 재는 데 쓴다. */
    getNode(): HTMLElement
    /** 화면 픽셀만큼 밀어 옮긴다. 덮인 영역을 피해 중앙을 잡을 때 쓴다. */
    panBy(dx: number, dy: number): void
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
    setZIndex(zIndex: number): void
    constructor(options: CustomOverlayOptions)
    setMap(map: Map | null): void
  }

  class Size {
    constructor(width: number, height: number)
  }

  class Point {
    constructor(x: number, y: number)
  }

  interface MarkerImageOptions {
    readonly offset?: Point
  }

  class MarkerImage {
    constructor(src: string, size: Size, options?: MarkerImageOptions)
  }

  interface MarkerOptions {
    readonly map?: Map
    readonly position: LatLng
    readonly title?: string
    /** 주지 않으면 SDK 기본 아이콘(파란 물방울)이 그려진다. */
    readonly image?: MarkerImage
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

  namespace services {
    type Status = 'OK' | 'ZERO_RESULT' | 'ERROR'

    const Status: {
      readonly OK: 'OK'
      readonly ZERO_RESULT: 'ZERO_RESULT'
      readonly ERROR: 'ERROR'
    }

    interface Address {
      readonly address_name: string
      readonly b_code: string
      readonly main_address_no: string
      readonly mountain_yn: 'Y' | 'N'
      readonly sub_address_no: string
    }

    interface RoadAddress {
      readonly address_name: string
    }

    interface AddressSearchResult {
      readonly address: Address | null
      readonly address_name: string
      readonly road_address: RoadAddress | null
      readonly x: string
      readonly y: string
    }

    type AddressSearchCallback = (
      results: readonly AddressSearchResult[],
      status: Status,
    ) => void

    class Geocoder {
      addressSearch(query: string, callback: AddressSearchCallback): void
    }

    interface PlacesSearchResultItem {
      readonly address_name: string
      readonly category_name?: string
      readonly place_name: string
      readonly road_address_name: string
      readonly x: string
      readonly y: string
    }

    interface Pagination {
      readonly current: number
      readonly last: number
      readonly totalCount: number
    }

    type PlacesSearchCallback = (
      results: readonly PlacesSearchResultItem[],
      status: Status,
      pagination: Pagination,
    ) => void

    class Places {
      keywordSearch(query: string, callback: PlacesSearchCallback): void
    }
  }
}

interface Window {
  kakao?: typeof kakao
}
