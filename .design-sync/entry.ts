// design-sync 입력 전용 배럴 — 앱 소스가 아니다.
// 이 저장소는 라이브러리가 아니라 앱이라 dist/ 진입점이 없다.
// 독립 렌더가 가능한(외부 API·지도 SDK·전역 상태에 의존하지 않는) 컴포넌트만 모은다.
// 제외: App, ComplexMap(카카오), ComplexSearch/UnitPicker/UnitSelectionFields(fetch),
//       PortfolioPanel(usePortfolio)

// 스타일 진입점 — 앱의 main.tsx 와 같은 순서로 싣는다.
// (main.tsx: fonts → tokens → base. 셋 다 동기화 대상 컴포넌트가 아니라 여기서 직접 싣는다.)
// portfolio.css 는 제외된 PortfolioPanel 이 import 하는데 PortfolioItemEditor 가 쓴다.
// fonts.css 의 @font-face 는 cfg.extraFonts 가 파싱해 woff2 를 fonts/ 로 복사하고
// url() 을 번들 기준으로 바꿔 쓴다 — 여기서 import 하면 절대경로 /fonts/… 가 404 난다.
import '../src/styles/tokens.css'
import '../src/styles/base.css'
import '../src/app.css'
import '../src/portfolio/portfolio.css'

// 미리보기용 표본 데이터. camelCase 라 컴포넌트로 잡히지 않는다.
export {
  sampleCalculations, sampleComparison, sampleTaxedItems,
  sampleConditions, sampleController,
  sampleComplex, sampleTrades, sampleAreaOptions,
} from './fixtures'

export { TaxTermHelp } from '../src/holding-screen/TaxTermHelp'
export { ConditionChoiceButtons } from '../src/holding-screen/ConditionChoiceButtons'
export { AutoFilledFactRow } from '../src/holding-screen/AutoFilledFactRow'
export { AutoFilledPropertyFacts } from '../src/holding-screen/AutoFilledPropertyFacts'
export { ComparisonTableRow } from '../src/holding-screen/ComparisonTableRow'
export { HoldingTaxChangeReasons } from '../src/holding-screen/HoldingTaxChangeReasons'
export { HoldingTaxComparisonTable } from '../src/holding-screen/HoldingTaxComparisonTable'
export { HoldingTaxConditions } from '../src/holding-screen/HoldingTaxConditions'
export { HoldingTaxOverlay } from '../src/holding-screen/HoldingTaxOverlay'
export { HoldingTaxResultSummary } from '../src/holding-screen/HoldingTaxResultSummary'
export { OfficialPriceGrowthFact } from '../src/holding-screen/OfficialPriceGrowthFact'
export { PortfolioItemEditor } from '../src/portfolio/PortfolioItemEditor'
export { ComplexBasics } from '../src/sidebar/ComplexBasics'
export { ComplexSidebar } from '../src/sidebar/ComplexSidebar'
export { TradeAreaSelect } from '../src/sidebar/TradeAreaSelect'
export { TradeHistory } from '../src/sidebar/TradeHistory'
export { YearlyTradeChart } from '../src/sidebar/YearlyTradeChart'
