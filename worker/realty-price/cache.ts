import type {
  OfficialPriceLookupResult,
  OfficialPriceRequest,
} from '../../shared/official-price'

const OFFICIAL_PRICE_CACHE_ORIGIN = 'https://official-price-cache.incometax'
const OFFICIAL_PRICE_CACHE_TTL_SECONDS = 24 * 60 * 60

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

function cacheRequest(request: OfficialPriceRequest, pnu: string): Request {
  const url = new URL('/history', OFFICIAL_PRICE_CACHE_ORIGIN)
  url.searchParams.set('assetKind', request.assetKind)
  url.searchParams.set('pnu', pnu)
  if (request.assetKind === 'apartment') {
    url.searchParams.set('complex', request.complexName)
    url.searchParams.set('dong', request.dong)
    url.searchParams.set('room', request.room)
  }
  return new Request(url)
}

export class CloudflareOfficialPriceCache implements OfficialPriceCache {
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
}
