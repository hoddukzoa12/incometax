# design-sync 메모 — incometax

## 이 저장소는 라이브러리가 아니다

앱이다. `package.json` 은 `private: true` 에 `main`/`module`/`exports`/`types` 가 없고,
`dist/` 라이브러리 산출물도 없다(`deploy` 가 `vite build && wrangler deploy` 로 앱을 만든다).
그래서 컨버터의 기본 경로가 두 군데서 막힌다. 아래 우회가 없으면 재동기화가 실패한다.

- **`node_modules/incometax` 가 없다** (npm 은 자기 패키지를 self-install 하지 않는다).
  `--entry` 없이 돌리면 `ENOENT … node_modules/incometax/package.json` 으로 죽는다.
  → `cfg.entry = ./.design-sync/entry.ts` (배럴). 컨버터가 여기서 위로 걸어 올라가
  저장소 루트의 `package.json` 을 패키지 루트로 삼는다.
- **`.d.ts` 트리가 없어 프롭 추출이 전부 `[key: string]: unknown` 이 된다.**
  추출기는 `<pkgDir>/index.d.ts` 를 진입점으로 읽는다(`lib/dts.mjs:87`).
  → `cfg.buildCmd` 가 tsc 로 `.ds-types/` 를 만들고, 루트 `index.d.ts` 가 그것을 재수출한다.
  **둘 다 gitignore 대상이다. 재동기화 전에 `buildCmd` 를 반드시 돌려라.**

## 배럴(`.design-sync/entry.ts`)이 하는 일

1. 독립 렌더 가능한 17개 컴포넌트만 재수출한다. 제외 6개는 외부 의존 때문이다 —
   `App`/`PortfolioPanel`(usePortfolio) · `ComplexMap`(카카오 SDK) ·
   `ComplexSearch`/`UnitPicker`/`UnitSelectionFields`(fetch).
2. **CSS 를 앱의 `main.tsx` 와 같은 순서로 싣는다** (tokens → base → app → portfolio).
   앱에서는 `main.tsx`/`App.tsx`/`PortfolioPanel` 이 나눠 싣는데 셋 다 동기화 대상이
   아니라서 여기서 직접 실어야 한다. **순서가 틀리면 컴포넌트 CSS 가 `var()` 를 못 푼다.**
3. 미리보기용 픽스처를 camelCase 로 재수출한다(컴포넌트로 안 잡힌다).

## 픽스처는 실제 엔진을 쓴다

`.design-sync/fixtures.ts` 가 `calculatePortfolioHoldingTax` 에 은마 1동 101호를 넣어
계산한다. 숫자를 손으로 적지 않았으므로 세법 룰이 바뀌면 카드도 따라온다.
**엔진의 성공 상태는 `'calculated'` 다** (`'ready'` 가 아니다 — 여기서 한 번 틀렸다).

## 폰트

`cfg.extraFonts = ['.design-sync/font-face.css']`.
앱의 `src/styles/fonts.css` 가 글꼴 정의의 SSOT 인데 url 이 `/fonts/…` 절대경로다.
수집기는 url 을 CSS 파일 위치 기준으로 풀어서(`lib/css.mjs:38`) 절대경로를 건너뛴다
(`[FONT_DANGLING]`). 그래서 `.design-sync/font-face.css` 가 같은 정의를 저장소 상대경로로
다시 가리킨다. **`src/styles/fonts.css` 의 family/weight/style/display 가 바뀌면 여기도 고쳐라.**

## Known render warns

없음. 최종 검증에서 `[FONT_*]`·`[GRID_OVERFLOW]`·`[RENDER_THIN]` 전부 해소됐다.

## floor 카드 2개 (의도된 것)

- `HoldingTaxOverlay` — `position: fixed` 전체 화면 셸이라 카드 프레임을 벗어난다.
  구성 요소(Conditions·ResultSummary·ComparisonTable·ChangeReasons)가 각각 카드로 있어
  셸 자체의 카드는 값이 없다. 미리보기를 지웠다.
- `ComplexSidebar` — `complexId` 로 API 를 조회하는 컨테이너다.

## 이번 동기화가 앱에서 찾아낸 결함

동기화가 코드를 다른 조건(charset 없는 문서, 앱 밖 렌더, 카드 나란히 보기)에 놓으면서
앱에서는 안 보이던 것이 드러났다. 재동기화 때도 같은 종류를 기대할 만하다.

- **P4-12** 조사 유틸의 `/[0-9A-Za-z가-힣]/u` 가 charset 이 틀어지면 SyntaxError 로
  번들 전체를 죽였다. 정규식 문자 클래스의 비-ASCII 범위만 치명적이다(문자열 리터럴은
  mojibake 로 끝난다). `가-힣` 이스케이프 + 회귀 테스트로 해결.
- **P4-13** `--font-family-sans` 가 Pretendard 를 선언만 하고 `@font-face` 도 `body` 규칙도
  없었다. macOS 에서만 멀쩡해 보이던 결함. 자체 호스팅 + `src/styles/base.css` 로 해결.
- **P4-14** `formatWon` 이 두 곳에 따로 있어 같은 금액이 `₩2,237,000,000` 과
  `2,237,000,000 원` 으로 갈렸다(R5 위반). **작업 중.**

## Re-sync risks — 다음 실행이 지켜볼 것

- **`.ds-types/` 와 `index.d.ts` 는 gitignore 대상이다.** 새 클론에서는 없다.
  `cfg.buildCmd` 를 먼저 돌리지 않으면 프롭이 전부 `unknown` 으로 돌아간다.
  조용히 나빠지는 종류라 눈치채기 어렵다.
- **`.design-sync/font-face.css` 는 `src/styles/fonts.css` 의 복제다.** 자동 동기화가 없다.
  앱 쪽 글꼴 정의가 바뀌면 여기가 조용히 낡는다.
- **`.design-sync/fixtures.ts` 는 도메인 타입 형태에 묶여 있다.**
  `StoredPortfolioItem`·`HoldingTaxConditionValues`·`RecentTrade` 가 바뀌면 컴파일이 깨진다
  (깨지는 편이 낫다 — 조용히 틀리지 않는다). `sampleConditions` 의 `items` 키는
  물건 id `A13583507` 에 묶여 있다.
- **`cfg.dtsPropsFor` 2건은 추출기가 `| null` 을 좁힌 것을 되돌린 것이다**
  (`ConditionChoiceButtons.value`, `ComplexSidebar.complexId`). 소스에서 그 프롭이
  바뀌면 override 가 낡는다. 재동기화 때 원본과 대조하라.
- **`guidelines/` 에 `docs/*.md` 13개가 통째로 올라간다.** 세법 명세·감사 문서까지 포함이라
  분량이 크다. 줄이려면 `cfg.guidelinesGlob` 을 좁혀라.
- **폰트 2.0MB 가 번들에 들어간다.** Pretendard Variable 전체본이다.
  동적 서브셋으로 바꾸면 100~300KB 로 준다(요청 수는 는다). 앱 쪽 P4-13 과 같은 판단.
- 검증기는 원격 `@import` 를 `@font-face` 로 세지 않는다. CDN 방식으로 되돌리면
  `[FONT_MISSING]` 이 다시 뜬다 — 실물이 정상이어도 그렇다.
