import { buildPnu, parseLotAddress } from './address'
import {
  LDONG_SNAPSHOT_KEY,
  refreshLdong,
  type LdongRefreshEnv,
  type LdongSnapshot,
} from './refresh'

const LDONG_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1_000

let memorySnapshot: LdongSnapshot | null = null

function refreshInBackground(
  env: LdongRefreshEnv,
  context: ExecutionContext | undefined,
): void {
  if (!context) return
  context.waitUntil(
    refreshLdong(env)
      .then((snapshot) => {
        memorySnapshot = snapshot
      })
      .catch(() => undefined),
  )
}

export async function getLdongSnapshot(
  env: LdongRefreshEnv,
  context?: ExecutionContext,
  now = Date.now(),
): Promise<LdongSnapshot | null> {
  if (memorySnapshot) {
    if (now - memorySnapshot.builtAt > LDONG_CACHE_TTL_MS) {
      refreshInBackground(env, context)
    }
    return memorySnapshot
  }

  const snapshot = await env.LDONG.get<LdongSnapshot>(
    LDONG_SNAPSHOT_KEY,
    'json',
  )
  if (!snapshot) {
    refreshInBackground(env, context)
    return null
  }

  memorySnapshot = snapshot
  if (now - snapshot.builtAt > LDONG_CACHE_TTL_MS) {
    refreshInBackground(env, context)
  }
  return snapshot
}

export async function addressToPnu(
  address: string,
  env: LdongRefreshEnv,
  context?: ExecutionContext,
): Promise<string | null> {
  const parsed = parseLotAddress(address)
  if (!parsed) return null

  const snapshot = await getLdongSnapshot(env, context)
  if (!snapshot) return null

  const legalDongCode = snapshot.codes[parsed.legalDongName]
  if (!legalDongCode) return null
  return buildPnu(parsed, legalDongCode)
}

export type AddressPnuResolution =
  | { readonly status: 'found'; readonly pnu: string }
  | { readonly status: 'noData' }
  | { readonly status: 'cacheUnavailable' }

export async function resolveAddressToPnu(
  address: string,
  env: LdongRefreshEnv,
  context?: ExecutionContext,
): Promise<AddressPnuResolution> {
  const parsed = parseLotAddress(address)
  if (!parsed) return { status: 'noData' }

  const snapshot = await getLdongSnapshot(env, context)
  if (!snapshot) return { status: 'cacheUnavailable' }

  const legalDongCode = snapshot.codes[parsed.legalDongName]
  if (!legalDongCode) return { status: 'noData' }

  const pnu = buildPnu(parsed, legalDongCode)
  return pnu ? { status: 'found', pnu } : { status: 'noData' }
}

export async function addressesToPnu(
  addresses: readonly string[],
  env: LdongRefreshEnv,
  context?: ExecutionContext,
): Promise<readonly { readonly address: string; readonly pnu: string | null }[]> {
  const snapshot = await getLdongSnapshot(env, context)

  return addresses.map((address) => {
    const parsed = parseLotAddress(address)
    const legalDongCode = parsed
      ? snapshot?.codes[parsed.legalDongName]
      : undefined
    return {
      address,
      pnu: parsed && legalDongCode ? buildPnu(parsed, legalDongCode) : null,
    }
  })
}

export function clearLdongMemoryCacheForTest(): void {
  memorySnapshot = null
}
