export const CURRENCY_MESSAGES = {
  wonStandalone: (amount: string) => `${amount} 원`,
  wonInline: (amount: string) => `${amount}원`,
  manwonInline: (amount: string) => `${amount}만원`,
} as const
