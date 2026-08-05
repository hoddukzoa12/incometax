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
