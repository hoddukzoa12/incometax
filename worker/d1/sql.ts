// Bound parameters remain preferred for Worker queries. Literal interpolation is
// limited to Wrangler CLI batches and bulk inserts that exceed D1's 100-parameter limit.
export const sqlString = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`

export const sqlNullableString = (value: string | null): string =>
  value === null ? 'NULL' : sqlString(value)

export const sqlNullableNumber = (value: number | null): string =>
  value === null ? 'NULL' : String(value)
