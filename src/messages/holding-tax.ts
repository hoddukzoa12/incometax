export const HOLDING_TAX_TERM_HELP = {
  comprehensiveTax: {
    title: '종합부동산세',
    description:
      '소유한 주택의 공시가격을 인별로 합산한 뒤 기본공제 등을 적용해 계산하는 국세예요.',
  },
  propertyTax: {
    title: '재산세',
    description:
      '매년 6월 1일 현재 소유한 부동산을 기준으로 물건별로 계산하는 지방세예요.',
  },
  adjustedArea: {
    title: '조정대상지역',
    description:
      '주택가격 상승률 등을 고려해 국토교통부가 지정하는 지역이에요. 일부 세율과 요건이 달라질 수 있어요.',
  },
  fairMarketValueRatio: {
    title: '공정시장가액비율',
    description:
      '공시가격에서 과세표준을 정할 때 적용하는 비율이에요.',
  },
  taxableBase: {
    title: '과세표준',
    description:
      '세율을 곱해 세액을 계산하는 기준 금액이에요. 공시가격과 공제액, 공정시장가액비율을 반영해 정해요.',
  },
  oneHouse: {
    title: '1세대1주택',
    description:
      '세대가 국내 주택 한 채를 소유한 경우예요. 재산세와 종합부동산세의 세부 판정 기준은 서로 달라요.',
  },
} as const

export type HoldingTaxHelpTerm = keyof typeof HOLDING_TAX_TERM_HELP

export const HOLDING_TAX_MESSAGES = {
  open: '보유세 비교',
  title: '보유세 비교',
  close: '닫기',
  helpSymbol: '?',
  helpOpen: (title: string) => `${title} 설명 열기`,
  helpClose: '닫기',
  governmentBillNotice: (reformYears: readonly number[]) =>
    `${reformYears.join('·')}년 수치는 국회 통과 전 정부안 기준이에요.`,
  samePriceModelNotice: (reformYears: readonly number[]) =>
    `${reformYears.join('·')}년 세부담상한은 같은 공시가격이 이어진다고 가정한 모형으로 계산했어요.`,
  assumptionsTitle: '계산에 사용한 조건',
  assumptionsChange: '계산 조건 변경',
  assumptionsDone: '조건 입력 닫기',
  conditionsIntro:
    '자동으로 채운 값을 확인하고 세액공제에 필요한 조건만 선택해 주세요.',
  conditionsRequired: '확인이 필요한 계산 조건',
  conditionsSave: '이 조건으로 계산',
  residencyMissing: (name: string) =>
    `${name}: 실제 거주 여부를 선택해 주세요.`,
  continuesResidenceMissing: (name: string) =>
    `${name}: 앞으로 거주기간을 늘려 계산할지 선택해 주세요.`,
  qualifyingRelocationMissing: (name: string) =>
    `${name}: 거주기간 인정 사유에 해당하는지 선택해 주세요.`,
  automaticFactsTitle: '자동으로 확인한 값',
  automaticFact: '자동 확인',
  editFact: '수정',
  finishEditingFact: '수정 닫기',
  officialPriceLabel: '공시가격',
  officialPriceBaseDateLabel: '공시가격 기준일',
  officialPriceBaseDateMissing: '기준일 확인 필요',
  areaKindLabel: '조정대상지역',
  ownershipShareLabel: '내 소유 지분',
  ownershipShareUnit: '%',
  generalArea: '해당하지 않음',
  adjustedArea: '해당함',
  ownerConditionsTitle: '소유자 조건',
  ageThresholdLabel: (years: number) => `만 ${years}세 이상`,
  exactPeriodsOpen: '나이·보유·거주 기간 직접 입력',
  exactPeriodsClose: '직접 입력 닫기',
  ownerAgeLabel: '2026년 6월 1일 기준 나이',
  holdingYearsLabel: '2026년 6월 1일 기준 보유기간',
  residenceYearsLabel: '2026년 6월 1일 기준 거주기간',
  yearsUnit: '년',
  propertyConditions: (name: string) => `${name} 계산 조건`,
  holdingThresholdLabel: (years: number) => `${years}년 이상 보유`,
  residenceThresholdLabel: (years: number) => `${years}년 이상 거주`,
  residencyQuestion: '이 집에 살고 계신가요?',
  continuesResidenceQuestion: '앞으로도 이 집에 계속 살 계획인가요?',
  qualifyingRelocationQuestion:
    '전근·취학·1년 이상 치료 등으로 다른 시·군으로 이사했나요?',
  yes: '네',
  no: '아니요',
  assumptionsSummary: (yearSummaries: readonly string[]) =>
    yearSummaries.join(' / '),
  yearAssumption: (
    year: number,
    ownerAge: number,
    itemSummaries: readonly string[],
  ) => `${year}년 6월 1일 기준 ${[`만 ${ownerAge}세`, ...itemSummaries].join(' · ')}`,
  itemAssumption: (
    name: string,
    holdingYears: number,
    residenceYears: number,
  ) => `${name} ${holdingYears}년 보유/${residenceYears}년 거주`,
  comparisonItem: '항목',
  comparisonBasis: '비고',
  propertySection: (name: string, share: string) =>
    `물건별 재산세 — ${name} · 지분 ${share}`,
  comprehensiveSection: '인별 종합부동산세',
  totalSection: '보유세 합계',
  emptyTitle: '계산할 부동산이 없어요.',
  emptyDescription: '지도에서 부동산을 내 목록에 먼저 담아 주세요.',
  noTaxedItemsTitle: '본인에게 과세되는 지분이 없어요.',
  noTaxedItemsDescription:
    '목록의 모든 지분이 0%예요. 세대 주택 수에는 포함하지만 본인 세액은 계산하지 않아요.',
  missingPriceTitle: '공시가격이 없어 합산 세액을 계산하지 않았어요.',
  missingPriceReason: (name: string) =>
    `${name}: 동·호별 공시가격을 확인할 수 없어요. 공시가격을 입력하면 계산할 수 있어요.`,
  householdCount: (count: number) => `세대 주택 ${count}건`,
  taxedCount: (count: number) => `본인 과세 지분 ${count}건`,
  yearLabel: (year: number, isCurrent: boolean) =>
    `${year}년 ${isCurrent ? '현행' : '정부안'}`,
  headlineTitle: (year: number) => `${year}년 보유세`,
  headlineBasis: (
    priceBasis: string,
    isCurrent: boolean,
  ) => `${priceBasis} · ${isCurrent ? '현행법' : '개편안(정부안)'} 기준`,
  headlineUnavailable: '계산 불가',
  wonStandalone: (amount: string) => `${amount} 원`,
  wonInline: (amount: string) => `${amount}원`,
  resultCardDisclaimer:
    '입력한 정보와 공개된 계산 방법으로 산출한 예측값이에요. 실제 부과 세액과 다를 수 있으니 참고용으로 사용해 주세요.',
  priceBasisUnknown: '공시가격 기준일 미입력',
  priceBasisMultiple: (dates: readonly string[]) =>
    `공시가격 기준일 ${dates.join('·')}`,
  totalTitle: '보유세 합계',
  totalUnavailable: '합계 미확정',
  currentYearCapUnavailable: (priorYear: number) =>
    `${priorYear}년 세법 자료가 없어 2026년 세부담상한을 계산할 수 없어요. 세부담상한은 세액을 줄이는 제도이므로 2026년 값은 실제 세액의 상한으로 봐 주세요.`,
  currentYearPriceMissing: (
    priorYear: number,
    names: readonly string[],
  ) => `${names.join(', ')}의 ${priorYear}년 공시가격 기록도 확인할 수 없어요.`,
  assumptionsProseTitle: '계산 가정',
  priceDateAssumption: (facts: readonly string[]) =>
    `공시가격은 ${facts.join(', ')}을 기준으로 사용했어요.`,
  continuingResidenceAssumption: (names: readonly string[]) =>
    `${names.join(', ')}은 2027년과 2028년에도 계속 거주해 거주기간이 해마다 1년씩 늘어난다고 가정했어요.`,
  frozenResidenceAssumption: (names: readonly string[]) =>
    `${names.join(', ')}은 거주기간이 2026년 이후 늘어나지 않는다고 가정했어요.`,
  recognitionAssumption: (names: readonly string[]) =>
    `${names.join(', ')}은 입력한 실제 거주기간이 끝난 때 다른 시·군으로 이사한 것으로 보고 거주기간 인정 특례를 계산했어요.`,
  modeledCapAssumption:
    '2027년과 2028년 세부담상한은 실제 전년도 고지액이 아니라 공시가격이 같다는 모형에서 계산한 전년도 세액을 사용했어요.',
  unavailableCapAssumption:
    '2026년은 2025년 세법 자료가 없어 세부담상한을 적용하지 않았어요. 상한은 세액을 줄이므로 표시값은 실제 세액보다 낮아지지 않는 방향의 값이에요.',
  cautionsTitle: '유의사항',
  cautions: [
    '본 계산기는 세무 대리 업무를 제공하는 서비스가 아니며, 사용자가 입력한 정보와 공개된 계산 방법으로 산출한 결과를 제공하는 서비스입니다.',
    '2027년 이후 수치는 2026년 세제개편안(정부안)을 기준으로 한 예측값입니다. 개편안은 국회 통과 전이므로 심의 과정에서 달라질 수 있습니다.',
    '계산 결과는 사용자가 입력한 정보에 기초한 예측값이므로 실제 부과 세액과 다를 수 있습니다. 참고용으로만 사용해 주세요.',
    '본 서비스는 계산 결과에 대해 어떠한 판단 또는 결정을 하지 않고, 정확성을 보증하지 않습니다.',
  ],
  propertyTaxTitle: '물건별 재산세',
  comprehensiveTaxTitle: '인별 종합부동산세',
  officialPrice: '시가표준액(공시가격)',
  ownershipShare: '내 소유 지분',
  ownedOfficialPrice: '내 지분 공시가격',
  fairMarketValueRatio: '공정시장가액비율',
  fullTaxableBase: '물건 전체 과세표준',
  taxableBase: '내 지분 과세표준',
  appliedRate: '적용세율',
  progressiveDeduction: '누진공제',
  preferentialRate: '1세대1주택 재산세 감면 특례',
  applied: '적용',
  notApplied: '미적용',
  baseTax: '본세',
  fullBaseTax: '물건 전체 산출세액',
  localEducationTax: '지방교육세',
  cityAreaTax: '도시지역분',
  propertyTaxTotal: '재산세 합계',
  ownedOfficialPriceTotal: '합산 공시가격',
  residentOwnedOfficialPrice: '거주주택 공시가격',
  taxableThreshold: '과세대상 기준',
  basicDeduction: '기본공제',
  propertyTaxCreditRatio: '재산세 공제 적용비율',
  propertyTaxCredit: '재산세 공제',
  calculatedTax: '산출세액',
  taxCredit: '세액공제',
  ageCreditRate: '연령 공제율',
  holdingCreditRate: '보유기간 공제율',
  residenceCreditRate: '거주기간 공제율',
  periodCreditRate: '적용 기간 공제율',
  nominalCreditRate: '합산 공제율',
  appliedCreditRate: '상한 적용 공제율',
  calculatedCredit: '공제율 적용액',
  creditAmountCap: '공제 금액한도',
  taxCreditNotApplicable: '해당 없음',
  taxCreditMissing: '소유자 나이가 없어 계산하지 못했어요.',
  burdenCapDeduction: '세부담상한 차감액',
  burdenCapRate: '세부담상한율',
  priorYearBase: '전년 기준액',
  maximumTaxBurden: '세부담 상한액',
  currentYearBase: '당해 기준액',
  burdenCapNotApplicable: '해당 없음',
  payableTax: '공제·상한 적용 후 본세',
  ruralSpecialTax: '농어촌특별세',
  comprehensiveTaxTotal: '종합부동산세 합계',
  unavailable: '계산 불가',
  noAmountCap: '없음',
  propertyTaxTotalAll: '재산세 납부액 합계',
  holdingTaxTotal: '보유세 총액',
  recognitionActualYears: '실제 거주기간',
  recognitionAddedYears: '추가 인정기간',
  recognitionCreditYears: '공제 적용 거주기간',
  years: (value: number) => `${value}년`,
  basisOfficialPrice: '단지·동·호별 공시가격',
  basisOwnershipShare: '내 지분',
  basisOwnedOfficialPrice: '공시가격 × 내 지분',
  basisFairMarketValueRatio: '공시가격과 세대 주택 수에 따른 비율',
  basisFullTaxableBase: '공시가격 × 공정시장가액비율',
  basisOwnedTaxableBase: '물건 전체 과세표준 × 내 지분',
  basisAppliedRate: '과세표준 구간에 따른 세율',
  basisProgressiveDeduction: '적용 세율 구간의 누진공제액',
  basisByYear: (year: number, basis: string) => `${year}년 ${basis}`,
  basisList: (items: readonly string[]) => items.join(' · '),
  basisBracketTax: (rate: string, deduction: string) =>
    `과세표준액 × ${rate} − ${deduction}`,
  basisLocalEducationTax: (rate: string) => `본세의 ${rate}`,
  basisCityAreaTax: (rate: string) => `과세표준액의 ${rate}`,
  basisSum: '위 금액을 합산',
  basisPreferentialApplied: '공시가격과 1세대1주택 요건을 충족해 적용',
  basisPreferentialNotApplied: (maximumPrice: string) =>
    `공시가격이 ${maximumPrice}을 초과하여 1세대1주택 재산세 감면 특례가 적용되지 않았어요.`,
  basisPreferentialHouseholdNotApplied:
    '세대가 1주택 요건을 충족하지 않아 1세대1주택 재산세 감면 특례가 적용되지 않았어요.',
  basisOwnedBaseTax: '물건 전체 산출세액 × 내 지분',
  basisTaxableThreshold: '세대 주택 수와 소유 형태에 따른 과세 기준',
  basisBasicDeduction: '주택 수와 거주주택 비중에 따른 공제',
  basisResidentPrice: '거주 중인 주택의 내 지분 공시가격 합계',
  basisComprehensiveTaxableBase:
    '(합산 공시가격 − 기본공제) × 공정시장가액비율',
  basisPropertyTaxCredit: '종합부동산세와 겹치는 재산세 상당액',
  basisCalculatedTax: '종합부동산세 본세 − 재산세 공제',
  basisCreditRate: '입력한 나이·보유기간·거주기간의 공제 구간',
  basisCreditAmount: '산출세액 × 적용 공제율',
  basisBurdenCap: '동일가격 모형의 전년도 기준액으로 계산',
  basisCurrentYearBurdenCap:
    '2025년 세법 자료가 없어 2026년 세부담상한은 계산하지 않음',
  basisPayableTax: '산출세액 − 세액공제 − 세부담상한 차감액',
  basisRuralSpecialTax: (rate: string) =>
    `공제·상한 적용 후 본세의 ${rate}`,
  basisResidenceRecognition: '입력한 실제 거주기간과 인정 특례',
} as const
