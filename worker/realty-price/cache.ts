import type {
  ApartmentUnitOptionsRequest,
  ApartmentUnitOptionsResult,
  OfficialPriceLookupResult,
  OfficialPriceRequest,
} from '../../shared/official-price'

const OFFICIAL_PRICE_CACHE_ORIGIN = 'https://official-price-cache.incometax'
const OFFICIAL_PRICE_CACHE_TTL_SECONDS = 24 * 60 * 60
const OFFICIAL_PRICE_CACHE_PATHS = {
  history: '/history',
  apartmentOptions: '/apartment-options',
} as const

export interface OfficialPriceCache {
  get(
    request: OfficialPriceRequest,
    pnu: string,
  ): Promise<OfficialPriceLookupResult | null>
  put(
    request: OfficialPriceRequest,
    pnu: string,
    result: OfficialPriceLookupResult,
  ): Promise<void>
}

export interface ApartmentUnitOptionsCache {
  getApartmentOptions(
    request: ApartmentUnitOptionsRequest,
    pnu: string,
  ): Promise<ApartmentUnitOptionsResult | null>
  putApartmentOptions(
    request: ApartmentUnitOptionsRequest,
    pnu: string,
    result: ApartmentUnitOptionsResult,
  ): Promise<void>
}

function cacheRequest(request: OfficialPriceRequest, pnu: string): Request {
  const url = new URL(
    OFFICIAL_PRICE_CACHE_PATHS.history,
    OFFICIAL_PRICE_CACHE_ORIGIN,
  )
  url.searchParams.set('assetKind', request.assetKind)
  url.searchParams.set('pnu', pnu)
  if (request.assetKind === 'apartment') {
    url.searchParams.set('complex', request.complexName)
    url.searchParams.set('dong', request.dong)
    url.searchParams.set('room', request.room)
    if (request.aptCode) url.searchParams.set('aptCode', request.aptCode)
  }
  return new Request(url)
}

function apartmentOptionsCacheRequest(
  request: ApartmentUnitOptionsRequest,
  pnu: string,
): Request {
  const url = new URL(
    OFFICIAL_PRICE_CACHE_PATHS.apartmentOptions,
    OFFICIAL_PRICE_CACHE_ORIGIN,
  )
  url.searchParams.set('v', '2')
  url.searchParams.set('pnu', pnu)
  url.searchParams.set('complex', request.complexName)
  if (request.dong) url.searchParams.set('dong', request.dong)
  if (request.aptCode) url.searchParams.set('aptCode', request.aptCode)
  return new Request(url)
}

export class CloudflareOfficialPriceCache implements
  ApartmentUnitOptionsCache,
  OfficialPriceCache {
  constructor(private readonly cache: Cache) {}

  async get(
    request: OfficialPriceRequest,
    pnu: string,
  ): Promise<OfficialPriceLookupResult | null> {
    const response = await this.cache.match(cacheRequest(request, pnu))
    if (!response) return null
    const cached = await response.json<OfficialPriceLookupResult>()
    return { ...cached, key: request.key }
  }

  async put(
    request: OfficialPriceRequest,
    pnu: string,
    result: OfficialPriceLookupResult,
  ): Promise<void> {
    if (result.status !== 'found') return

    const response = new Response(JSON.stringify(result), {
      headers: {
        'cache-control': `public, max-age=${OFFICIAL_PRICE_CACHE_TTL_SECONDS}`,
        'content-type': 'application/json; charset=UTF-8',
      },
    })
    await this.cache.put(cacheRequest(request, pnu), response)
  }

  async getApartmentOptions(
    request: ApartmentUnitOptionsRequest,
    pnu: string,
  ): Promise<ApartmentUnitOptionsResult | null> {
    const response = await this.cache.match(
      apartmentOptionsCacheRequest(request, pnu),
    )
    if (!response) return null
    const cached = await response.json<ApartmentUnitOptionsResult>()
    return { ...cached, key: request.key }
  }

  async putApartmentOptions(
    request: ApartmentUnitOptionsRequest,
    pnu: string,
    result: ApartmentUnitOptionsResult,
  ): Promise<void> {
    if (result.status !== 'found') return

    const response = new Response(JSON.stringify(result), {
      headers: {
        'cache-control': `public, max-age=${OFFICIAL_PRICE_CACHE_TTL_SECONDS}`,
        'content-type': 'application/json; charset=UTF-8',
      },
    })
    await this.cache.put(apartmentOptionsCacheRequest(request, pnu), response)
  }
}
