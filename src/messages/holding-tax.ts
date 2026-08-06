import { withKoreanParticle } from '../i18n/korean-particle'
import {
  getKnownPeriodMinimumYears,
  getOwnerAgeKnowledge,
} from '../holding-screen/condition-values'

const ageAssumption = (year: number, ownerAge: number): string => {
  const knowledge = getOwnerAgeKnowledge(year, ownerAge)
  if (knowledge.kind === 'youngerThan') return `만 ${knowledge.years}세 미만`
  if (knowledge.kind === 'atLeast') return `만 ${knowledge.years}세 이상`
  return `만 ${knowledge.years}세`
}

const periodAssumption = (
  years: number,
  label: string,
): string | null => {
  const knownMinimumYears = getKnownPeriodMinimumYears(years)
  return knownMinimumYears === null
    ? null
    : `${knownMinimumYears}년 이상 ${label}`
}

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
  title: '보유세 비교',
  close: '닫기',
  helpSymbol: '?',
  helpOpen: (title: string) => `${title} 설명 열기`,
  helpClose: '닫기',
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
  officialPriceAssumptionTitle: '공시가격 가정',
  officialPriceGrowthRateLabel: '공시가격 상승률',
  officialPriceGrowthRateValue: (rate: string, unchanged: boolean) =>
    `연 ${rate}${unchanged ? ' (그대로)' : ''}`,
  annualRatePrefix: '연',
  percentUnit: '%',
  officialPriceHistoryDescription:
    '예측값이 아니라 조회한 공시가격 이력이에요. 해마다 오른 폭과 내린 폭을 함께 보여드려요.',
  officialPriceHistoryTitle: (name: string) => `${name} 공시가격 이력`,
  officialPriceHistoryUnavailable: '비교할 공시가격 이력이 없어요.',
  officialPriceHistoryStart: (year: number, price: string) =>
    `${year}년 ${price}`,
  officialPriceHistoryChange: (
    year: number,
    price: string,
    changeRate: string,
  ) => `${year}년 ${price} · 전년 대비 ${changeRate}`,
  officialPriceHistorySummary: (
    years: number,
    rate: string,
    highestRise: string,
    deepestFall: string,
  ) => `최근 ${years}년 연평균 상승률(CAGR) 약 ${rate} · 최고 ${highestRise} · 최저 ${deepestFall}`,
  officialPriceHistorySummaryUnavailable: (yearCount: number) =>
    `${yearCount}년치 이력이 있어요. 연평균 상승률은 이력이 더 쌓이면 계산할 수 있어요.`,
  officialPriceHistoryExtremum: (year: number, rate: string) =>
    `${rate}(${year}년)`,
  officialPriceHistoryNoRise: '오른 해 없음',
  officialPriceHistoryNoFall: '내린 해 없음',
  officialPriceHistoryOpen: '전체 이력 보기',
  officialPriceHistoryClose: '최근 이력만 보기',
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
    yearSummaries.filter((summary) => summary.length > 0).join(' / '),
  yearAssumption: (
    year: number,
    ownerAge: number | null,
    itemSummaries: readonly string[],
  ) => {
    const details = [
      ownerAge === null ? null : ageAssumption(year, ownerAge),
      ...itemSummaries.filter((summary) => summary.length > 0),
    ].filter((detail): detail is string => detail !== null)
    return details.length === 0
      ? ''
      : `${year}년 6월 1일 기준 ${details.join(' · ')}`
  },
  itemAssumption: (
    name: string,
    holdingYears: number,
    residenceYears: number,
  ) => {
    const periods = [
      periodAssumption(holdingYears, '보유'),
      periodAssumption(residenceYears, '거주'),
    ].filter((period): period is string => period !== null)
    return periods.length === 0 ? '' : `${name} ${periods.join('/')}`
  },
  comparisonItem: '항목',
  statementAmount: '금액',
  comparisonBasis: '근거',
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
  portfolioAssumption: (householdCount: number, taxedCount: number) =>
    `세대 주택 ${householdCount}건 중 본인 과세 지분 ${taxedCount}건을 합산했어요.`,
  headlineTitle: (year: number) => `${year}년 보유세`,
  headlineBasis: (
    priceBasis: string,
    isCurrent: boolean,
  ) => `${priceBasis} · ${isCurrent ? '현행법' : '개편안(정부안)'} 기준`,
  headlineUnavailable: '계산 불가',
  wonStandalone: (amount: string) => `${amount} 원`,
  wonInline: (amount: string) => `${amount}원`,
  changeUnavailable: '지금과의 차이를 계산할 수 없어요.',
  changeSame: '지금과 같아요.',
  changeDecrease: (amount: string) => `지금보다 ${amount} 줄어요.`,
  changeIncrease: (amount: string) => `지금보다 ${amount} 늘어요.`,
  comparisonSnapshot: (
    currentYear: number,
    currentAmount: string,
    lastYear: number,
    lastAmount: string,
  ) => `${currentYear}년 현행 ${currentAmount} · ${lastYear}년 ${lastAmount}`,
  changeReasonsOpen: (change: number | null) => {
    if (change === null || change === 0) return '무엇이 달라졌나요?'
    return change < 0
      ? '무엇 때문에 줄었나요?'
      : '무엇 때문에 늘었나요?'
  },
  changeReasonsClose: '변경 이유 닫기',
  changeReasonsTitle: '바뀐 항목',
  burdenCapChangeReason: '세부담상한',
  beforeBurdenCapTax: '상한 적용 전 세액',
  burdenCapApplied: (deduction: string) => `${deduction} 차감`,
  burdenCapNotApplied: '적용 없음',
  changeContributionIncrease: (amount: string) => `${amount} 늘리는 요인`,
  changeContributionDecrease: (amount: string) => `${amount} 줄이는 요인`,
  changeTransition: (
    fromYear: number,
    fromValue: string,
    toYear: number,
    toValue: string,
  ) => `${fromYear}년 ${fromValue} → ${toYear}년 ${toValue}`,
  evidenceOpen: '계산 근거 보기',
  evidenceClose: '계산 근거 닫기',
  evidenceTitle: '계산 근거',
  yearSelectionLabel: '계산 연도 선택',
  yearTab: (year: number) => `${year}년`,
  yearUnavailable: (year: number) => `${year}년 계산 결과가 없어요.`,
  resultCardDisclaimer:
    '입력한 정보로 계산한 예상 세액이에요. 실제 부과 세액과 다를 수 있어요.',
  priceBasisUnknown: '공시가격 기준일 미입력',
  priceBasisMultiple: (dates: readonly string[]) =>
    `공시가격 기준일 ${dates.join('·')}`,
  totalUnavailable: '합계 미확정',
  assumptionsProseTitle: '계산 가정',
  priceDateAssumption: (facts: readonly string[]) => {
    const joinedFacts = facts.join(', ')
    return `공시가격은 ${withKoreanParticle(joinedFacts, '을/를')} 기준으로 사용했어요.`
  },
  continuingResidenceAssumption: (names: readonly string[]) => {
    const joinedNames = names.join(', ')
    return `${withKoreanParticle(joinedNames, '은/는')} 2027년과 2028년에도 계속 거주해 거주기간이 해마다 1년씩 늘어난다고 가정했어요.`
  },
  frozenResidenceAssumption: (names: readonly string[]) => {
    const joinedNames = names.join(', ')
    return `${withKoreanParticle(joinedNames, '은/는')} 거주기간이 2026년 이후 늘어나지 않는다고 가정했어요.`
  },
  recognitionAssumption: (names: readonly string[]) => {
    const joinedNames = names.join(', ')
    return `${withKoreanParticle(joinedNames, '은/는')} 입력한 실제 거주기간이 끝난 때 다른 시·군으로 이사한 것으로 보고 거주기간 인정 특례를 계산했어요.`
  },
  modeledCapAssumption:
    '2027년과 2028년 세부담상한은 실제 전년도 고지액 대신 화면에 표시한 공시가격 가정으로 계산한 전년도 세액을 사용했어요.',
  unavailableCapAssumption: (
    priorYear: number,
    names: readonly string[],
  ) => `${names.join(', ')}의 ${priorYear}년 공시가격 기록이 없어 2026년 세부담상한을 적용하지 않았어요. 상한은 세액을 줄이므로 표시값은 실제 세액보다 낮아지지 않는 방향의 값이에요.`,
  cautionsTitle: '유의사항',
  cautions: [
    '본 계산기는 세무 대리 업무를 제공하는 서비스가 아니며, 사용자가 입력한 정보와 공개된 계산 방법으로 산출한 결과를 제공하는 서비스입니다.',
    '2027년 이후 수치는 2026년 세제개편안(정부안)을 기준으로 한 예측값입니다. 개편안은 국회 통과 전이므로 심의 과정에서 달라질 수 있습니다.',
    '계산 결과는 사용자가 입력한 정보에 기초한 예측값이므로 실제 부과 세액과 다를 수 있습니다. 참고용으로만 사용해 주세요.',
    '합산배제(임대주택·사원용주택 등), 상속주택·지방 저가주택·일시적 2주택 특례, 부부공동명의 1주택자 특례 신청, 토지분 종합부동산세(종합합산·별도합산)는 계산하지 않아 해당하면 실제보다 높은 세액이 표시될 수 있습니다.',
  ],
  officialPrice: '공시가격',
  ownedOfficialPrice: '내 지분 공시가격',
  fairMarketValueRatio: '공정시장가액비율',
  fullTaxableBase: '과세표준',
  taxableBase: '내 지분 과세표준',
  comprehensiveTaxableBase: '과세표준',
  appliedRate: '적용세율',
  propertyBaseTax: '재산세',
  propertyOwnedBaseTax: '재산세 지분',
  localEducationTax: '지방교육세',
  cityAreaTax: '도시지역분',
  statementTotal: '합계',
  ownedOfficialPriceTotal: '합산 공시가격',
  basicDeduction: '기본공제',
  propertyTaxCredit: '재산세 공제',
  calculatedTax: '산출세액',
  taxCredit: '세액공제',
  burdenCapDeduction: '세부담상한 차감액',
  ruralSpecialTax: '농어촌특별세',
  comprehensiveTaxTotal: '종합부동산세 합계',
  unavailable: '계산 불가',
  propertyTaxTotalAll: '재산세 납부액 합계',
  holdingTaxTotal: '보유세 총액',
  basisInputValue: '입력값',
  basisOwnershipApplied: (share: string) => `공시가격 × 소유지분(${share})`,
  basisRatioApplied: (rate: string) => `공정시장가액비율 ${rate} 적용`,
  basisTaxableBaseOwnershipApplied: (share: string) =>
    `과세표준 × 소유지분(${share})`,
  basisBracketTax: (rate: string, deduction: string) =>
    `과세표준 × ${rate} − ${deduction}`,
  basisLocalEducationTax: (rate: string) => `재산세의 ${rate}`,
  basisCityAreaTax: (rate: string) => `과세표준의 ${rate}`,
  basisPropertyOwnershipApplied: (share: string) =>
    `재산세 × 소유지분(${share})`,
  basisPropertyTaxSum: '재산세 + 지방교육세 + 도시지역분',
  basisOwnedOfficialPriceTotal: '내 지분 공시가격 합계',
  basisOneHouseDeduction: '1세대1주택',
  basisMultiHouseDeduction: '다주택 기본공제',
  basisComprehensiveTaxableBaseWithRate: (rate: string) =>
    `(합산 공시가격 − 기본공제) × 공정시장가액비율 ${rate}`,
  basisPropertyTaxCredit: '재산세와 겹치는 부분',
  basisTaxCredit: '입력한 나이·보유기간·거주기간 공제',
  basisBurdenCap: {
    observed: (priorYear: number) =>
      `실제 ${priorYear}년 공시가격·${priorYear}년 시행 세법으로 계산`,
    modeled: '공시가격 상승률 가정으로 계산한 전년도 기준액(모형)',
    unavailable: '전년도 공시가격 이력이 없어 미적용',
  },
  basisRuralSpecialTax: (rate: string) =>
    `공제·상한 적용 후 본세의 ${rate}`,
  basisComprehensiveTaxSum: '종부세 본세 + 농어촌특별세',
  basisPropertyPortfolioSum: '물건별 재산세 합계',
  basisHoldingTaxSum: '재산세 + 종합부동산세',
} as const
