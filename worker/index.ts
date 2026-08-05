import type {
  OfficialPriceBatchRequest,
  OfficialPriceRequest,
} from '../shared/official-price'
import type { PnuBatchRequest, PnuBatchResponse } from '../shared/pnu'
import { handleComplexBbox } from './complex/bbox'
import {
  handleComplexDetail,
  handleComplexSearch,
} from './complex/catalog'
import { handleComplexOfficialPrice } from './complex/official-price'
import { handleComplexTrades } from './complex/trades'
import { handleComplexUnitOptions } from './complex/unit-options'
import { addressesToPnu } from './ldong/lookup'
import {
  LDONG_SNAPSHOT_KEY,
  refreshLdong,
  type LdongRefreshEnv,
  type LdongSnapshot,
} from './ldong/refresh'
import { CloudflareOfficialPriceCache } from './realty-price/cache'
import { OfficialPriceService } from './realty-price'

const NO_CONTENT_STATUS = 204
const BAD_REQUEST_STATUS = 400
const MAXIMUM_BATCH_SIZE = 100
const LDONG_REFRESH_CRON = '0 19 * * *'

export type Env = LdongRefreshEnv & {
  readonly COMPLEX_DB: D1Database
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function normalizeOfficialPriceRequest(
  value: unknown,
): OfficialPriceRequest | null {
  if (!isRecord(value)) return null

  const assetKind = value.assetKind
  const key = optionalString(value.key) ?? ''
  const address = optionalString(value.address) ?? ''
  const pnu = optionalString(value.pnu)

  if (assetKind === 'detachedHouse') {
    return { assetKind, key, address, pnu }
  }
  if (assetKind !== 'apartment') return null

  return {
    assetKind,
    key,
    address,
    pnu,
    complexName: optionalString(value.complexName) ?? '',
    dong: optionalString(value.dong) ?? '',
    room: optionalString(value.room) ?? '',
  }
}

function normalizeOfficialPriceBatch(
  value: unknown,
): OfficialPriceBatchRequest | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null
  const items = value.items.map(normalizeOfficialPriceRequest)
  if (items.some((item) => item === null)) return null
  return { items: items as OfficialPriceRequest[] }
}

let officialPriceService: OfficialPriceService | null = null

function getOfficialPriceService(): OfficialPriceService {
  if (!officialPriceService) {
    const workerCaches = caches as CacheStorage & { readonly default: Cache }
    const cache = new CloudflareOfficialPriceCache(workerCaches.default)
    officialPriceService = new OfficialPriceService({
      cache,
      unitOptionsCache: cache,
    })
  }
  return officialPriceService
}

async function handlePnuRequest(
  request: Request,
  env: Env,
  context: ExecutionContext,
): Promise<Response> {
  const body: unknown = await request.json().catch(() => null)
  if (!isRecord(body) || !Array.isArray(body.addresses)) {
    return json({ error: 'addresses 배열이 필요합니다.' }, BAD_REQUEST_STATUS)
  }
  const addresses = body.addresses.filter(
    (address): address is string => typeof address === 'string',
  )
  if (addresses.length !== body.addresses.length) {
    return json({ error: 'addresses에는 문자열만 허용됩니다.' }, BAD_REQUEST_STATUS)
  }
  const normalizedRequest: PnuBatchRequest = { addresses }
  const response: PnuBatchResponse = {
    results: await addressesToPnu(normalizedRequest.addresses, env, context),
  }
  return json(response)
}

async function handleOfficialPriceRequest(
  request: Request,
  env: Env,
  context: ExecutionContext,
): Promise<Response> {
  const body = normalizeOfficialPriceBatch(await request.json().catch(() => null))
  if (!body) {
    return json({ error: '공시가격 요청 형식이 올바르지 않습니다.' }, BAD_REQUEST_STATUS)
  }
  if (body.items.length > MAXIMUM_BATCH_SIZE) {
    return json(
      { error: `한 번에 최대 ${MAXIMUM_BATCH_SIZE}건까지 조회할 수 있습니다.` },
      BAD_REQUEST_STATUS,
    )
  }

  const results = await getOfficialPriceService().lookupBatch(
    body.items,
    env,
    context,
  )
  return json({ results })
}

export default {
  async fetch(request, env, context): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/ldong/status' && request.method === 'GET') {
      const snapshot = await env.LDONG.get<LdongSnapshot>(
        LDONG_SNAPSHOT_KEY,
        'json',
      )
      return json({ cached: Boolean(snapshot), meta: snapshot ? {
        builtAt: snapshot.builtAt,
        count: snapshot.count,
        source: snapshot.source,
      } : null })
    }
    if (url.pathname === '/api/pnu' && request.method === 'POST') {
      return handlePnuRequest(request, env, context)
    }
    if (url.pathname === '/api/realty-prices' && request.method === 'POST') {
      return handleOfficialPriceRequest(request, env, context)
    }
    if (url.pathname === '/api/complexes' && request.method === 'GET') {
      return handleComplexBbox(url, env.COMPLEX_DB)
    }
    if (url.pathname === '/api/complexes/search' && request.method === 'GET') {
      return handleComplexSearch(url, env.COMPLEX_DB)
    }
    const complexTradesPath = /^\/api\/complexes\/([^/]+)\/trades$/.exec(
      url.pathname,
    )
    if (complexTradesPath && request.method === 'GET') {
      return handleComplexTrades(
        env.COMPLEX_DB,
        complexTradesPath[1],
        env.DATA_GO_KR_SERVICE_KEY,
      )
    }
    const complexOfficialPricePath =
      /^\/api\/complexes\/([^/]+)\/official-price$/.exec(url.pathname)
    if (complexOfficialPricePath && request.method === 'POST') {
      return handleComplexOfficialPrice(
        request,
        env.COMPLEX_DB,
        complexOfficialPricePath[1],
        getOfficialPriceService(),
        env,
        context,
      )
    }
    const complexUnitOptionsPath =
      /^\/api\/complexes\/([^/]+)\/unit-options$/.exec(url.pathname)
    if (complexUnitOptionsPath && request.method === 'GET') {
      return handleComplexUnitOptions(
        url,
        env.COMPLEX_DB,
        complexUnitOptionsPath[1],
        getOfficialPriceService(),
        env,
        context,
      )
    }
    const complexDetailPath = /^\/api\/complexes\/([^/]+)$/.exec(url.pathname)
    if (complexDetailPath && request.method === 'GET') {
      return handleComplexDetail(env.COMPLEX_DB, complexDetailPath[1])
    }

    return new Response(null, { status: NO_CONTENT_STATUS })
  },

  async scheduled(controller, env, context): Promise<void> {
    if (controller.cron !== LDONG_REFRESH_CRON) return
    context.waitUntil(
      refreshLdong(env).catch((error) => {
        console.error('법정동코드 정기 갱신 실패', error)
      }),
    )
  },
} satisfies ExportedHandler<Env>
