export interface ComplexSummary {
  readonly complexId: string
  readonly name: string
  readonly legalAddress: string
  readonly roadAddress: string | null
  readonly legalDongCode: string
  readonly approvalDate: string | null
  readonly buildingCount: number
  readonly householdCount: number
  readonly lat: number
  readonly lng: number
}

export interface ComplexBboxResponse {
  readonly items: readonly ComplexSummary[]
  readonly truncated: boolean
}
