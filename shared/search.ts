export interface AddressSearchResult {
  readonly address: string
  readonly roadAddress?: string
  readonly placeName?: string
  readonly lat: number
  readonly lng: number
  readonly bCode?: string
  readonly isMountain?: boolean
  readonly mainNumber?: string
  readonly subNumber?: string
}

export interface AddressComplexSelection {
  readonly origin: 'address'
  readonly complexId: null
  readonly pnu: string
  readonly aptCode: string
  readonly complexName: string
  readonly legalDongCode: string
  readonly address: string
  readonly roadAddress?: string
  readonly lat: number
  readonly lng: number
}
