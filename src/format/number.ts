const ASCII_MINUS_SIGN = '-'
const MINUS_SIGN = '−'

const INTEGER_FORMATTER = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
})

export const normalizeMinusSign = (value: string): string =>
  value.replaceAll(ASCII_MINUS_SIGN, MINUS_SIGN)

export const formatInteger = (value: number): string =>
  normalizeMinusSign(INTEGER_FORMATTER.format(value))
