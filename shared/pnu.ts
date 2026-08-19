import { isLegalDongCode } from './legal-dong'

const PNU_NUMBER_WIDTH = 4

export interface LotPnuParts {
  readonly legalDongCode: string
  readonly isMountain: boolean
  readonly mainNumber: string
  readonly subNumber: string
}

export const buildPnuFromLot = (parts: LotPnuParts): string | null => {
  if (!isLegalDongCode(parts.legalDongCode)) return null
  if (!/^\d{1,4}$/u.test(parts.mainNumber)) return null
  if (!/^\d{1,4}$/u.test(parts.subNumber)) return null

  return [
    parts.legalDongCode,
    parts.isMountain ? '2' : '1',
    parts.mainNumber.padStart(PNU_NUMBER_WIDTH, '0'),
    parts.subNumber.padStart(PNU_NUMBER_WIDTH, '0'),
  ].join('')
}

export interface PnuBatchRequest {
  readonly addresses: readonly string[]
}

export interface PnuLookupItem {
  readonly address: string
  readonly pnu: string | null
}

export interface PnuBatchResponse {
  readonly results: readonly PnuLookupItem[]
}
