## 이 시스템이 무엇인가

한국 부동산 **세금 계산** 화면의 부품이다. 2026 세제개편안 기준으로 보유세를 계산하고,
그 결과와 근거를 사람이 믿을 수 있게 보여 주는 것이 전부다. 범용 UI 킷이 아니다 —
표·금액 행·조건 입력처럼 **세금 화면에 특화된 것**만 있다.

## 감싸는 법

**프로바이더가 없다.** 컴포넌트를 그냥 렌더하면 된다. 대신 두 가지를 지켜야 스타일이 산다.

1. `styles.css` 를 불러온다. 폰트(Pretendard)·토큰·컴포넌트 CSS 가 전부 그 import 닫힘 안에 있다.
2. **화면 루트에 클래스를 건다.** 각 화면의 CSS 가 루트 클래스에 걸려 있어서,
   그 밖에서 렌더하면 여백·타이포가 빠진다.

```jsx
<div className="holding-overlay">
  <HoldingTaxResultSummary
    calculations={calculations} taxedItems={items}
    detailsOpen={false} reasonsOpen={false}
    onDetailsToggle={…} onReasonsToggle={…}
  />
</div>
```

루트 클래스: `holding-overlay`(보유세 화면) · `holding-conditions`(조건 입력) ·
`complex-sidebar`(단지 상세) · `app-shell__map`(지도).
계산서 표는 `holding-tax-table` 을 `<table>` 에 건다.

## 스타일 어휘 — 유틸리티 클래스가 없다

Tailwind 같은 유틸리티가 **없다.** 새 이름을 지어내지 말고 **CSS 변수**를 쓴다.

| 갈래 | 실제 이름 |
|---|---|
| 색 | `--color-accent` `--color-danger` `--color-warning` `--color-neutral-0` `--color-neutral-50` `--color-neutral-100` `--color-neutral-200` `--color-neutral-300` `--color-neutral-500` `--color-neutral-600` `--color-neutral-700` `--color-neutral-900` |
| 여백 | `--space-1` `--space-2` `--space-3` `--space-4` `--space-6` |
| 글자 크기 | `--font-size-xs` `--font-size-sm` `--font-size-md` `--font-size-base` `--font-size-lg` `--font-size-xl` |
| 굵기 | `--font-weight-regular` `--font-weight-medium` `--font-weight-semibold` `--font-weight-bold` |
| 모서리·그림자 | `--radius-sm` `--radius-md` `--radius-pill` `--shadow-sm` `--shadow-lg` |
| 터치 | `--size-touch-target-min` (44px) |

```jsx
<div style={{ padding: 'var(--space-4)', background: 'var(--color-neutral-0)',
              borderRadius: 'var(--radius-md)' }}>
```

새 화면의 레이아웃 글루는 이 변수로 짠다. 하드코딩한 px·hex 를 섞지 마라.

## 세금 화면에서 지켜야 할 것

**세액이 늘었다고 빨간색을 쓰지 않는다.** 방향은 문구로 말한다 —
`839,088원 늘어요` / `306,432원 줄어요`. `--color-danger` 는 오류와 삭제에만 쓴다.

**법정 용어를 풀어 쓰지 않는다.** `1세대1주택`·`공정시장가액비율`·`과세표준`은
그대로 두고 `TaxTermHelp` 로 설명을 붙인다. 이름을 바꾸면 사용자가 고지서와 대조하지 못한다.

**금액 옆에 근거를 붙인다.** 계산서는 `항목 | 금액 | 근거` 3열이다 —
`과세표준 · 1,006,650,000 원 · 공정시장가액비율 45% 적용`.
비율을 독립 행으로 빼지 말고 근거 문장에 넣는다.

**값이 0이거나 윗행과 같으면 행을 감춘다.** 정보가 0비트인 행을 늘어놓지 않는다.

**모르는 값을 아는 것처럼 쓰지 않는다.** 사용자가 입력하지 않았으면 단정하지 말고 생략한다.

**문체는 해요체.** 예외는 하단 유의사항뿐이고 거기만 `-습니다`체다.

## 어디에 진실이 있나

- **스타일**: `_ds/<folder>/styles.css` 와 그 import 닫힘. 실제 CSS 를 읽어라 — 이 요약보다 정확하다.
- **API**: 각 컴포넌트의 `<Name>.d.ts` 가 계약이다. 프롭은 여기가 유일한 근거다.
- **쓰는 법**: 각 컴포넌트의 `<Name>.prompt.md`.
- **세법 근거**: `guidelines/docs/tax-rules-spec.md`(조문·개편안 페이지) ·
  `guidelines/docs/golden-cases.md`(검산 사례).
- **문구 규칙**: `guidelines/docs/ux-writing-guide.md`.

## 부품 목록

**계산 결과** `HoldingTaxResultSummary`(답 + 증감액) · `HoldingTaxChangeReasons`(왜 바뀌었나) ·
`HoldingTaxComparisonTable`(연도 탭 계산서) · `ComparisonTableRow`(계산서 한 행, `<table>` 안에서만)

**조건 입력** `HoldingTaxConditions`(조건 화면 전체) · `AutoFilledPropertyFacts`(자동 확인 블록) ·
`AutoFilledFactRow`(자동 확인 한 줄) · `ConditionChoiceButtons`(네/아니요) ·
`OfficialPriceGrowthFact`(공시가격 상승률 + 과거 이력) · `TaxTermHelp`(용어 도움말)

**단지·거래** `ComplexBasics` · `TradeAreaSelect` · `TradeHistory` · `YearlyTradeChart`

**내 부동산** `PortfolioItemEditor`

`HoldingTaxOverlay`(전체 화면 셸)와 `ComplexSidebar`(단지 조회 컨테이너)는 각각
`position: fixed` 와 API 조회에 묶여 있어 카드로 보이지 않는다. 번들에는 있으니 쓸 수는 있다.
