import { isLegalDongCode } from '../../shared/legal-dong.ts'

const HYPHEN_VARIANTS_PATTERN = /[‐‑‒–—−]/g
const LOT_TOKEN_PATTERN = /^산$|^산?\d/
const LOT_NUMBER_PATTERN = /^(산)?\s*(\d+)(?:-(\d+))?/
const PNU_NUMBER_WIDTH = 4

const PROVINCE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  '서울': '서울특별시',
  '부산': '부산광역시',
  '대구': '대구광역시',
  '인천': '인천광역시',
  '광주': '광주광역시',
  '대전': '대전광역시',
  '울산': '울산광역시',
  '세종': '세종특별자치시',
  '경기': '경기도',
  '강원': '강원특별자치도',
  '충북': '충청북도',
  '충남': '충청남도',
  '전북': '전북특별자치도',
  '전남': '전라남도',
  '경북': '경상북도',
  '경남': '경상남도',
  '제주': '제주특별자치도',
}

function expandProvince(token: string): string {
  return PROVINCE_ABBREVIATIONS[token] ?? token
}

export interface ParsedLotAddress {
  readonly legalDongName: string
  readonly isMountain: boolean
  readonly mainNumber: string
  readonly subNumber: string
}

export function parseLotAddress(address: string): ParsedLotAddress | null {
  const normalized = address
    .replace(HYPHEN_VARIANTS_PATTERN, '-')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = normalized.split(' ')
  const lotTokenIndex = tokens.findIndex((token) => LOT_TOKEN_PATTERN.test(token))

  if (lotTokenIndex <= 0) return null

  const match = LOT_NUMBER_PATTERN.exec(tokens.slice(lotTokenIndex).join(' '))
  if (!match) return null

  const dongTokens = tokens.slice(0, lotTokenIndex)
  dongTokens[0] = expandProvince(dongTokens[0])

  return {
    legalDongName: dongTokens.join(' '),
    isMountain: Boolean(match[1]),
    mainNumber: match[2],
    subNumber: match[3] ?? '0',
  }
}

export function buildPnu(
  parsed: ParsedLotAddress,
  legalDongCode: string,
): string | null {
  if (!isLegalDongCode(legalDongCode)) return null
  if (!/^\d{1,4}$/.test(parsed.mainNumber)) return null
  if (!/^\d{1,4}$/.test(parsed.subNumber)) return null

  const landKind = parsed.isMountain ? '2' : '1'
  return [
    legalDongCode,
    landKind,
    parsed.mainNumber.padStart(PNU_NUMBER_WIDTH, '0'),
    parsed.subNumber.padStart(PNU_NUMBER_WIDTH, '0'),
  ].join('')
}
