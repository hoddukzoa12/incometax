import type {
  ComplexMatchCandidate,
  PreparedComplexMatchCandidate,
  RawTrade,
  StagedTrade,
  TradeDataset,
  TradeDatasetResult,
  TradeMatchResult,
} from '../../shared/trade.ts'
import { parseLotAddress } from '../ldong/address.ts'

const HYPHEN_VARIANTS_PATTERN = /[‐‑‒–—−]/g
const COMPLEX_NAME_NOISE_PATTERN = /아파트|apt|주상복합|공동주택|단지/giu
const FLOOR_QUALIFIER_PATTERN = /\(?고층\)?|\(?중층\)?|\(?저층\)?/gu
const NON_NAME_CHARACTER_PATTERN = /[^\p{L}\p{N}]/gu
const LEGAL_DONG_SUFFIX_PATTERN = /[동읍면리]$/u
const PHASE_SUFFIX_PATTERN = /(?:제)?\d+(?:차)?$/u
const ONE_DAY_MS = 24 * 60 * 60 * 1_000

const compact = (value: string): string => value.replace(/\s+/g, '').trim()

export const normalizeJibun = (value: string): string => {
  const normalized = value
    .normalize('NFKC')
    .replace(HYPHEN_VARIANTS_PATTERN, '-')
    .replace(/번지/g, '')
    .replace(/\s+/g, '')
    .trim()
  const isMountain = normalized.startsWith('산')
  const body = isMountain ? normalized.slice(1) : normalized
  const match = /^(\d+)(?:-(\d+))?/.exec(body)
  if (!match) return normalized
  const subNumber = match[2] ? `-${Number(match[2])}` : ''
  return `${isMountain ? '산' : ''}${Number(match[1])}${subNumber}`
}

export const normalizeComplexName = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(FLOOR_QUALIFIER_PATTERN, '')
    .replace(COMPLEX_NAME_NOISE_PATTERN, '')
    .replace(NON_NAME_CHARACTER_PATTERN, '')

const nameWithoutLegalDong = (name: string, legalDongName: string): string => {
  const normalizedName = normalizeComplexName(name)
  const legalDongStem = normalizeComplexName(legalDongName).replace(
    LEGAL_DONG_SUFFIX_PATTERN,
    '',
  )
  if (!legalDongStem || !normalizedName.startsWith(legalDongStem)) {
    return normalizedName
  }
  return normalizedName.slice(legalDongStem.length) || normalizedName
}

export const prepareComplexCandidate = (
  candidate: ComplexMatchCandidate,
): PreparedComplexMatchCandidate => {
  const address = parseLotAddress(candidate.legalAddress)
  const lot = address
    ? `${address.isMountain ? '산' : ''}${address.mainNumber}${
        Number(address.subNumber) === 0 ? '' : `-${address.subNumber}`
      }`
    : ''

  return {
    ...candidate,
    legalDongName: address?.legalDongName.split(/\s+/).pop() ?? '',
    normalizedJibun: normalizeJibun(lot),
    normalizedName: nameWithoutLegalDong(
      candidate.name,
      address?.legalDongName.split(/\s+/).pop() ?? '',
    ),
  }
}

export const matchesDong = (
  trade: RawTrade,
  candidate: PreparedComplexMatchCandidate,
): boolean => {
  if (!trade.legalDongName || !candidate.legalDongName) return true
  return compact(trade.legalDongName) === compact(candidate.legalDongName)
}

const uniqueNamedCandidate = (
  trade: RawTrade,
  candidates: readonly PreparedComplexMatchCandidate[],
  allowPhaseFallback = false,
): PreparedComplexMatchCandidate | null => {
  const normalizedName = nameWithoutLegalDong(
    trade.buildingName,
    trade.legalDongName,
  )
  if (!normalizedName) return null
  const matches = candidates.filter(
    (candidate) => candidate.normalizedName === normalizedName,
  )
  if (matches.length === 1) return matches[0]
  if (matches.length > 1 || !allowPhaseFallback) return null

  const phaseBase = normalizedName.replace(PHASE_SUFFIX_PATTERN, '')
  if (!phaseBase || phaseBase === normalizedName) return null
  const phaseMatches = candidates.filter(
    (candidate) =>
      candidate.normalizedName.replace(PHASE_SUFFIX_PATTERN, '') === phaseBase,
  )
  return phaseMatches.length === 1 ? phaseMatches[0] : null
}

export const matchTrade = (
  trade: RawTrade,
  candidates: readonly PreparedComplexMatchCandidate[],
): TradeMatchResult => {
  const sameDong = candidates.filter((candidate) => matchesDong(trade, candidate))
  const normalizedJibun = normalizeJibun(trade.jibun)
  const sameLot = normalizedJibun
    ? sameDong.filter(
        (candidate) => candidate.normalizedJibun === normalizedJibun,
      )
    : []

  if (sameLot.length === 1) {
    return { status: 'matched', matchLevel: 'lot', complex: sameLot[0] }
  }
  if (sameLot.length > 1) {
    const named = uniqueNamedCandidate(trade, sameLot, true)
    return named
      ? { status: 'matched', matchLevel: 'lot', complex: named }
      : { status: 'ambiguous' }
  }

  const named = uniqueNamedCandidate(trade, sameDong)
  if (named) {
    return { status: 'matched', matchLevel: 'candidate', complex: named }
  }
  const normalizedName = nameWithoutLegalDong(
    trade.buildingName,
    trade.legalDongName,
  )
  const namedMatches = normalizedName
    ? sameDong.filter((candidate) => candidate.normalizedName === normalizedName)
    : []
  return namedMatches.length > 1
    ? { status: 'ambiguous' }
    : { status: 'unmatched' }
}

export const tradeIdentityKey = (trade: RawTrade): string =>
  JSON.stringify([
    trade.source,
    compact(trade.legalDongName),
    normalizeJibun(trade.jibun),
    compact(trade.buildingName),
    compact(trade.houseType),
    trade.floor,
    trade.exclusiveArea,
    compact(trade.landArea),
    compact(trade.totalFloorArea),
    trade.dealDate,
    trade.dealAmount,
  ])

const isCancellation = (trade: RawTrade): boolean =>
  trade.cancellationType === 'O' || trade.cancellationDate !== ''

export const removeCanceled = (
  trades: readonly RawTrade[],
): { readonly items: readonly RawTrade[]; readonly removedCount: number } => {
  const canceledKeys = new Set(
    trades.filter(isCancellation).map(tradeIdentityKey),
  )
  const items = trades.filter(
    (trade) => !isCancellation(trade) && !canceledKeys.has(tradeIdentityKey(trade)),
  )
  return { items, removedCount: trades.length - items.length }
}

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

const dateValue = (value: string): number => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return Number.NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export const isWithinTradeWindow = (
  dealDate: string,
  cutoffDate: string,
  windowEndDate: string,
): boolean => {
  const deal = dateValue(dealDate)
  const cutoff = dateValue(cutoffDate)
  const windowEnd = dateValue(windowEndDate)
  return (
    Number.isFinite(deal) &&
    deal >= cutoff &&
    deal < windowEnd + ONE_DAY_MS
  )
}

export const prepareTradeDataset = async (
  dataset: TradeDataset,
  rawTrades: readonly RawTrade[],
  candidates: readonly PreparedComplexMatchCandidate[],
  cutoffDate: string,
  windowEndDate: string,
): Promise<TradeDatasetResult> => {
  const cancellationResult = removeCanceled(rawTrades)
  const uniqueItems = new Map(
    cancellationResult.items.map((trade) => [tradeIdentityKey(trade), trade]),
  )
  const deduplicated = [...uniqueItems.values()]
  const eligible = deduplicated.filter((trade) =>
    isWithinTradeWindow(trade.dealDate, cutoffDate, windowEndDate),
  )
  const matched: Array<{
    readonly trade: RawTrade
    readonly complexId: string
    readonly matchLevel: StagedTrade['matchLevel']
  }> = []
  let lotCount = 0
  let candidateCount = 0
  let ambiguousCount = 0
  let unmatchedCount = 0

  for (const trade of eligible) {
    const match = matchTrade(trade, candidates)
    if (match.status === 'ambiguous') {
      ambiguousCount += 1
      continue
    }
    if (match.status === 'unmatched') {
      unmatchedCount += 1
      continue
    }
    if (match.matchLevel === 'lot') lotCount += 1
    else candidateCount += 1
    matched.push({
      trade,
      complexId: match.complex.complexId,
      matchLevel: match.matchLevel,
    })
  }
  const trades: readonly StagedTrade[] = await Promise.all(
    matched.map(async ({ trade, complexId, matchLevel }) => ({
      tradeId: await sha256(tradeIdentityKey(trade)),
      complexId,
      source: trade.source,
      matchLevel,
      dealDate: trade.dealDate,
      dealAmount: trade.dealAmount,
      exclusiveArea: trade.exclusiveArea,
      floor: trade.floor,
    })),
  )

  return {
    dataset,
    trades,
    stats: {
      rawCount: rawTrades.length,
      canceledCount: cancellationResult.removedCount,
      duplicateCount: cancellationResult.items.length - deduplicated.length,
      outsideWindowCount: deduplicated.length - eligible.length,
      activeCount: eligible.length,
      matchedCount: matched.length,
      lotCount,
      candidateCount,
      ambiguousCount,
      unmatchedCount,
    },
  }
}
