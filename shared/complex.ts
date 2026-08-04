import type { RecentTrade } from './trade'

export const COMPLEX_LOOKUP_STATUSES = [
  'pending',
  'matched',
  'notFound',
  'rejected',
] as const

export type ComplexLookupStatus = (typeof COMPLEX_LOOKUP_STATUSES)[number]

export const RETRYABLE_COMPLEX_LOOKUP_STATUSES = [
  'rejected',
  'notFound',
] as const satisfies readonly ComplexLookupStatus[]

export interface ComplexListRecord {
  readonly complexId: string
  readonly name: string
  readonly legalDongCode: string
  readonly province: string | null
  readonly district: string | null
  readonly legalDong: string | null
  readonly ri: string | null
}

export interface CompleteComplexListRecord extends ComplexListRecord {
  readonly province: string
  readonly legalDong: string
}

export interface ComplexListExclusion {
  readonly complexId: string
  readonly name: string
  readonly legalDongCode: string
  readonly reason: string
}

export interface ComplexStagingRecord {
  readonly complexId: string
  readonly name: string
  readonly legalAddress: string
  readonly roadAddress: string | null
  readonly legalDongCode: string
  readonly approvalDate: string | null
  readonly buildingCount: number | null
  readonly householdCount: number | null
  readonly lat: number | null
  readonly lng: number | null
  readonly lookupStatus: Exclude<ComplexLookupStatus, 'pending'>
  readonly backfillReason: string | null
}

export interface ComplexSummary {
  readonly complexId: string
  readonly name: string
  readonly legalAddress: string
  readonly roadAddress: string | null
  readonly legalDongCode: string
  readonly approvalDate: string | null
  readonly buildingCount: number | null
  readonly householdCount: number | null
  readonly lat: number
  readonly lng: number
  readonly latestTrade: RecentTrade | null
}

export interface ComplexBboxResponse {
  readonly items: readonly ComplexSummary[]
  readonly truncated: boolean
}
