const HYPHEN_VARIANTS_PATTERN = /[‐‑‒–—−]/g
const LOT_TOKEN_PATTERN = /^산$|^산?\d/
const LOT_NUMBER_PATTERN = /^(산)?\s*(\d+)(?:-(\d+))?/
const PNU_NUMBER_WIDTH = 4

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

  return {
    legalDongName: tokens.slice(0, lotTokenIndex).join(' '),
    isMountain: Boolean(match[1]),
    mainNumber: match[2],
    subNumber: match[3] ?? '0',
  }
}

export function buildPnu(
  parsed: ParsedLotAddress,
  legalDongCode: string,
): string | null {
  if (!/^\d{10}$/.test(legalDongCode)) return null
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
