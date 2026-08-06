# 절대 규칙 감사 — 2026-08-05

**대상** `788edd2` 시점의 전체 트리
**기준** [AGENTS.md](../AGENTS.md) §3 (R1~R5)
**성격** 리뷰 보고서. 소스는 수정하지 않았다.
**순서** R5 → R1 → R2 → R3 → R4 (프로젝트 소유자 지정 우선순위)

각 항목은 `file:line`, 실제 실패 결과, **CONFIRMED**(추적해 확인) / **SUSPECTED**(의심되나
증명하지 못함)를 함께 적는다.

---

## 규칙별 판정 요약

| 규칙 | 판정 | 근거 |
|---|---|---|
| **R5 SSOT** | ❌ **위반 다수** | 활성화 게이트가 두 갈래로 갈려 이미 모순 상태(F1). 그 밖에 의미 중복 6건 |
| R1 중첩 조건문 | ✅ **양호** | 세법 분기는 전부 테이블 조회·가드절. 3단 이상 중첩 없음 |
| R2 하드코딩 | 🟡 **경미** | UI 문자열·색상·간격·URL 전부 상수화됨. 매직 넘버 1건(F5) |
| R3 모듈화 | 🟡 **1건** | `scripts/ingest-complexes.ts` 459줄은 분리 대상(F8). `worker/realty-price/`는 양호 |
| R4 트랜잭션 | 🟡 **부분 충족** | "검증 미달 시 기존 데이터 유지"는 **성립**. 원자성 근거 주석이 사실과 다름(F3) |

---

## R5 — SSOT (최우선)

### F1. 활성화 게이트가 두 곳에 있고 서로 모순된다 — **CONFIRMED** 🔴 최고 심각도

`activateStaging()`(라이브 `complex` 테이블 교체)을 호출하는 진입점이 **둘**이고,
각자 **자기만의 "최소 기대 건수" 정의**를 가진다.

| 진입점 | 게이트 | 위치 |
|---|---|---|
| `npm run ingest:complexes` | `validation.total_count === verification.totalCount` | `scripts/ingest-complexes.ts:382` |
| `npm run geocode:complexes` | `validation.total_count === expected_count − exclusions.length` | `scripts/geocode.ts:61-62`, `scripts/geocode.ts:129` |

**같은 사실("적재가 충분한가")이 두 번, 서로 다르게 적혀 있다.**
`exclusions.length > 0`이면 두 조건은 **동시에 참일 수 없다.**

**이미 모순 상태다.** `.artifacts/ingest-report.json`의 실제 값:

```
sourceCount(verification.totalCount) = 22,259
validation.total_count               = 22,259     ← 제외분도 스테이징에 남아 있다
basisExclusions.length               = 13
```

- `ingest-complexes.ts` 게이트: `22259 === 22259` → **통과**
- `geocode.ts` 게이트: `22259 !== 22259 − 13 = 22246` → **항상 throw**

**실패 결과.** `npm run geocode:complexes`는 현재 데이터에서 **영구히 활성화에 도달하지 못한다.**
`Staging count 22259 does not match expected usable source count 22246`로 죽는다.
지오코딩을 다 마쳐도 라이브 반영이 안 된다. 반대로 `ingest-complexes.ts`는 같은 스테이징을
"검증 통과"로 판정한다. 한 테이블에 대해 두 스크립트가 **서로 다른 답**을 낸다 — R5가 막으려던
바로 그 상황이다.

> 부수 발견: `saveComplexExclusion`(`scripts/lib/d1-complex.ts:235`)은 **호출부가 하나도 없다.**
> 그런데 `excluded_records_json`에는 13건이 살아 있고 `geocode.ts`의 게이트가 그 값에 의존한다.
> 현재 코드로는 제외 목록을 갱신할 방법이 없다 — 이전 버전이 남긴 고정 데이터다. (R3 / DoD 5)

### F2. `requiredRegionsPresent`가 그대로 두 번 복사돼 있다 — **CONFIRMED** 🟠

- `scripts/ingest-complexes.ts:103-112`
- `scripts/geocode.ts:28-37`

본문이 **한 글자도 다르지 않다.** 게다가 판정 기준이 되는 지역 접두사는 **세 번째 장소**에 있다:
`scripts/lib/d1-complex.ts:21-26`(`REQUIRED_REGION_PREFIXES`).

**실패 결과.** "필수 지역 표본"(R4의 검증 요건)을 한 곳에서 늘리면 — 예컨대 광주(`29`)를 추가하면 —
다른 진입점은 그 지역이 **비어 있어도 라이브 교체를 승인한다.** 지도에서 한 광역시가 통째로
사라진 데이터가 사용자에게 노출될 수 있다.

### F3. 문서가 룰 데이터 값을 다시 적는다 — **CONFIRMED** 🟠

세율·공제·비율은 `src/rules/`에만 있어야 한다(AGENTS §3 R5). 그런데:

| 문서 | 중복 기재 | 코드상 원본 |
|---|---|---|
| `docs/golden-cases.md:45-56` | 과세대상 12억/9억·14억, 기본공제, 공정시장가액비율 60/70/80%, 재산세 비율 43/44/45%·60%, 재산세 공제 0.4%, 농특세 20% | `src/rules/comprehensive-tax.ts:13-87`, `src/rules/property-tax.ts:14-21`, `:252-260` |
| `docs/product-vision.md:64-71` | 종부세 세율표 3개 열 전체(3억 .5 / 6억 .7 / 12억 1.3 …) | `src/rules/comprehensive-tax.ts:90-246` |
| `docs/roadmap.md:390-391` | 세부담상한 150%→200%, 세액공제 한도 800만/600만 | `src/rules/comprehensive-tax-burden-cap.ts:7-17`, `src/rules/comprehensive-tax-credit.ts:63,76` |

**실패 결과.** AGENTS §9는 "국회 심의 과정에서 내용이 바뀔 수 있다"를 전제로 못박고 있다.
값이 바뀌면 `src/rules/`는 고쳐지고 문서는 조용히 남는다. 그런데 AGENTS §5는
**"골든 케이스의 기대값과 1원까지 일치해야 하고, 기대값을 구현에 맞추어 수정하지 않는다"** 고
규정한다. 즉 `golden-cases.md`의 낡은 "적용 규칙 요약"이 **정답의 권위**를 갖게 되고,
그 아래 기대 세액은 옛 규칙으로 계산된 값이므로 — **구현이 옳은데도 틀렸다고 판정되어
되돌려지는** 경로가 생긴다.

> 구분해 둘 것: `golden-cases.md`의 **기대 세액**(`4,824,000` 등)은 중복이 아니라 요구사항이다.
> 문제는 그 위의 "적용 규칙 요약" 표 — 입력 규칙을 다시 쓴 부분이다.

### F4. `normalizeComplexName`이 같은 이름으로 두 번, 규칙이 다르다 — **CONFIRMED** 🟠

| 위치 | 동작 |
|---|---|
| `worker/trade/matching.ts:37-43` | NFKC → 소문자 → `아파트\|apt\|주상복합\|공동주택\|단지` 제거 → 고/중/저층 제거 → 문자·숫자 외 전부 제거 |
| `worker/realty-price/normalize.ts:41-43` | 앞머리 지번 `(123-4)` 제거 → 공백 제거 → 구두점 제거 → **`제` 제거** → **대문자화** |

두 함수는 **겹치는 규칙이 거의 없다.** `단지`는 한쪽만 제거하고, `제`는 다른 쪽만 제거하며,
대소문자 방향이 정반대다.

**실패 결과.** `worker/realty-price/normalize.ts:54` `resolveComplex()`는 **어느 단지의
공시가격을 가져올지 고르는 함수**다. 공시가격은 곧바로 과세표준이 된다. 한쪽 정규화 규칙에
노이즈 토큰을 추가하면(예: `1단지`/`2단지` 구분 처리) 실거래가 매칭은 반영되고 공시가격
해석은 반영되지 않는다 → 같은 단지에 대해 **실거래가는 붙는데 공시가격은 다른 동을 집어오거나
`ambiguous`로 떨어진다.** 이름이 같아서 import 한 쪽만 보고 고치면 반드시 놓친다.

### F5. Worker 런타임에 SQL 작성 방식이 두 가지다 — **CONFIRMED** 🟡

동일한 `trade` 계열 테이블에 대해:

| 파일 | 방식 | 배치 크기 |
|---|---|---|
| `worker/trade/d1-store.ts:98-129` | `.prepare().bind()` + `database.batch()` | `TRADE_INSERT_BATCH_SIZE` = `floor(100/9)` = **11** (`:7-11`, 파라미터 한도에서 유도) |
| `worker/trade/statements.ts:63-90` | `sqlString()` 문자열 보간 | `TRADE_INSERT_BATCH_SIZE` = **125** (`:7`, 근거 주석 없는 리터럴) |

`worker/trade/statements.ts`는 CLI 전용이 아니다 — `worker/trade/repository.ts:26`가 import 하고
`D1TradeRefreshRepository`가 Worker 런타임에서 쓴다.

그런데 `worker/d1/sql.ts:1-2`의 정책 주석은 이렇게 말한다:

> "Bound parameters remain preferred for Worker queries. Literal interpolation is
> **limited to Wrangler CLI batches and bulk inserts** that exceed D1's 100-parameter limit."

`repository.ts`는 CLI 배치가 아니고, `clearTradeDatasetStatements`·`checkpointTradeDatasetStatement`는
bulk insert도 아니다. **정책을 적어 둔 모듈을 그 정책을 어기는 코드가 import 하고 있다.**

**실패 결과.** 이름이 같은 두 상수가 값이 11과 125로 다르다. 누군가 "배치 크기가 두 군데
있으니 맞추자"며 `d1-store.ts`를 125로 올리면 D1의 100 파라미터 한도를 넘겨 런타임 실패한다.
반대로 `statements.ts`를 11로 내리면 statement 수가 11배로 늘어 갱신이 급격히 느려진다.
두 값이 왜 다른지는 **코드 어디에도 적혀 있지 않다.**

부수: `statements.ts:76-78`에서 `dealAmount`·`exclusiveArea`는 원시 보간이고 `floor`만
`sqlNullableNumber()`를 쓴다. 숫자 직렬화 방식이 한 리터럴 안에서 두 가지다.
(다만 `worker/trade/source.ts:118-126`의 `requirePositiveNumber`/`requirePositiveInteger`가
앞단에서 막아 주므로 **현재는 실제 결함이 아니다** — 일관성 문제로만 기록한다.)

### F6. 재시도 판정이 이름은 같고 기준은 다르다 — **CONFIRMED** 🟡

| 위치 | 판정 |
|---|---|
| `worker/ldong/refresh.ts:105-107` | `429 \|\| >= 500` |
| `worker/realty-price/client.ts:140-142` | **`400`** `\|\| 429 \|\| >= 500` |

`400`을 재시도 대상으로 넣은 이유가 주석에 없다. 두 모듈은 그 밖에도
`defaultSleep`(`refresh.ts:49` / `client.ts:55`)과 재시도 루프 구조를 각자 구현한다.

**실패 결과.** "이 외부 API 상태코드는 재시도해야 하는가"는 하나의 정책인데 두 벌이다.
한쪽에 `503` 백오프 정책을 넣어도 다른 쪽은 그대로다. 무한 대기 금지(R4-b)는 양쪽 모두
타임아웃·재시도 상한이 있어 **충족**한다.

### F7. 그 밖의 중복 정의 — **CONFIRMED** 🟡 (낮음)

| 식별자 | 위치 | 비고 |
|---|---|---|
| `isSupportedAssetKind` | `src/holding/validation.ts:25-26`, `src/transfer/validation.ts:20-21` | 본문 동일. **세법 레이어** 중복이라 R5 예시 그 자체 |
| 기간 검증 메시지 문자열 | `src/holding/validation.ts:17-18`, `src/transfer/validation.ts:12-13` | 문자열 리터럴이 완전히 동일 |
| `DEFAULT_CAP_APPORTIONMENT_RATIO`, `MAXIMUM_RATIO` | `src/transfer/calc.ts:23-24`, `src/transfer/validation.ts:5,7` | 검증과 계산이 각자의 기본값을 들고 있다 |
| `HYPHEN_VARIANTS_PATTERN` | `worker/ldong/address.ts:3`, `worker/trade/matching.ts:12` | 정규식 동일. `matching.ts`는 이미 `address.ts`에서 import 중 |
| `decodeServiceKey` | `worker/ldong/refresh.ts:97-103`, `scripts/lib/complex-source.ts:75-81` | 본문 동일 |
| `isRecord` | **10개 파일** | 본문 동일 |
| `ONE_DAY_MS`, `JsonRecord`, `KAKAO_AUTH_SCHEME`, `optionalString`, `PROGRESS_INTERVAL`, `delay` | 2~4개 파일 | 본문 동일 |

**실패 결과.** `HYPHEN_VARIANTS_PATTERN`이 가장 실질적이다. 새 하이픈 변종(예: `⁃` U+2043)을
`address.ts`에만 추가하면 주소 파싱은 정규화하고 `normalizeJibun`은 하지 않아 **지번이 어긋나
실거래가가 단지에 매칭되지 않는다** — 지도·사이드바에서 거래가 사라진다.

`ZERO_AMOUNT`/`ZERO_RATE`(7개 파일)는 **지적하지 않는다.** 이름 붙인 0은 드리프트 위험이 없다.

---

## R1 — 중첩 조건문 객체화 → ✅ 양호

**세법 분기는 전부 테이블 조회 또는 가드절이다.** 3단 이상 중첩 if를 찾지 못했다.

확인한 근거(코디네이터의 정규식 결과를 재실행한 것이 아니라 읽어서 판정):

- `src/holding/comprehensive-tax.ts:24-78` — `getBasicDeduction`/`getFairMarketValueRatio`/
  `getBrackets` 모두 가드절 + 단일 삼항. 값은 `rules.*` 테이블에서 온다
- `src/holding/comprehensive-tax-credit.ts:26-37` — `PERIOD_RATE_BY_KIND`가 보유/최대/거주
  세 갈래를 **키로 조회하는 객체**로 표현. R1이 요구하는 형태 그 자체
- `src/rules/property-tax.ts:34-79` — 일반/특례 세율을 한 행 테이블에서 파생. 분기 없음
- `src/transfer/calc.ts:51-91,152-176` — 불리언을 먼저 만들고 삼항 한 번. 중첩 아님

들여쓰기 깊은 지점(`scripts/ingest-complexes.ts:296`, `src/map/ComplexMap.tsx:184`,
`src/search/ComplexSearch.tsx:43`)을 각각 열어 확인했으나 **콜백 중첩으로 인한 들여쓰기**이고
조건 분기 자체는 2단을 넘지 않는다. AGENTS §3 R1은 2단까지 허용한다.

---

## R2 — 하드코딩 금지 → 🟡 경미

**대체로 잘 지켜지고 있다.** 확인한 항목:

- UI 문자열: `.tsx`에 직접 박힌 한글 문자열 **0건**. 전부 `src/messages/`
- 색상·간격·반경·그림자·폰트: `src/styles/tokens.css` 토큰만 사용 (아래 CSS 항목 참조)
- 외부 URL: `worker/config/external-apis.ts`에 집중
- 지도 상수: `src/map/constants.ts`. `COMPLEX_MARKER_CAP`은 `shared/complex.ts`에서 파생 —
  상한을 두 번 적지 않았다
- 타임아웃·재시도·페이지크기: 각 모듈 최상단에 이름 붙은 상수
- 세율: 전부 `src/rules/<연도>.ts`, 출처 주석 있음

**유일한 위반:** `worker/trade/statements.ts:7`의 `TRADE_INSERT_BATCH_SIZE = 125`.
근거 주석이 없는 매직 넘버다. 짝인 `worker/trade/d1-store.ts:9-11`은
`MAXIMUM_D1_BOUND_PARAMETERS / INSERT_COLUMN_COUNT`로 **유도**하고 있어 대비가 뚜렷하다.
(F5와 동일 건)

### 알려진 미해결 항목 — border-radius 6종 / spacing 20종의 출처

**답: 우리 CSS가 아니다.** 측정으로 확정했다.

```
$ grep -rhoE "border-radius:[^;]+;" src --include='*.css' | sort | uniq -c
  12 border-radius: var(--radius-sm);
   9 border-radius: var(--radius-md);
   2 border-radius: var(--radius-pill);
```

**반경 리터럴 0건, 토큰 3종 정확히 일치.** 간격도 마찬가지다 —
`padding`/`margin`/`gap`에 쓰인 원시 `px` 값은 **0건**이고 `var(--space-*)` 5종만 119회 쓰인다.

우리 CSS의 원시 `px`는 7건뿐이고 전부 간격이 아닌 치수다:
패널 폭 `min(92vw, 410px)`·`min(410px, 38vw)`, `width: 190px`, 헤어라인 `1px` 2건,
말풍선 꼬리 `6px solid transparent` 2건.

따라서 런타임에서 관측된 초과분의 출처는 **(a) 브라우저 UA 기본 스타일**(`input`·`button`·
`select`의 엔진별 기본 반경과 패딩)과 **(b) 카카오맵 SDK가 주입하는 DOM**이다.
SDK는 `src/map/loadKakaoMapsSdk.ts:3`에서 원격 스크립트로 로드되어 지도 컨트롤·저작권 표시·
마커·인포윈도우를 **자체 인라인 스타일로** 그린다. 우리 스타일시트가 닿지 않는 영역이다.

**조치 권고: 없음.** 토큰 위반이 아니다. 지표를 우리 스타일시트 범위로 한정하거나
SDK 주입 노드를 제외하고 재측정할 것을 권한다. UA 기본값을 덮으려고 리셋을 넓히면
오히려 R2와 무관한 CSS만 늘어난다.

---

## R3 — 모듈화 → 🟡 1건

### F8. `scripts/ingest-complexes.ts` 459줄은 분리 대상 — **CONFIRMED** 🟡

책임이 최소 **다섯 가지** 섞여 있다:

| 책임 | 위치 |
|---|---|
| CLI 인자 파싱·환경변수 검증 | `:114-146` |
| 검증 계약 파일 I/O·스키마 검증 | `:68-101` |
| 체크포인트 재개 오케스트레이션 | `:153-237` |
| 조회 루프·동시성·중단 판정 | `:256-353` |
| 게이트 평가·리포트 조립 | `:355-452` |

`main()` 하나가 **340줄**이다(`:114-453`). AGENTS §3 R3의 300줄 신호를 파일과 함수 양쪽에서
넘긴다. 특히 게이트 평가(`:355-408`)는 순수 함수로 분리 가능한데 지금은 I/O 한가운데 있어
**단위 테스트가 불가능하다.** F1의 모순이 테스트로 잡히지 않은 이유가 여기 있다.

분리 제안: `readVerificationContract`(파일 I/O) / 게이트 평가(순수) / 조회 루프(I/O) 세 모듈.
게이트 평가를 순수 함수로 빼면 F1·F2도 자연히 한 곳으로 모인다.

### `worker/realty-price/` → ✅ 양호

요청받은 대로 R1·R3 관점에서 8개 파일을 전부 읽었다. **분리가 깔끔하다.**

| 파일 | 줄 | 책임 |
|---|---|---|
| `client.ts` | 264 | HTTP·재시도·페이싱·CAPTCHA 판정 (I/O) |
| `index.ts` | 282 | 서비스 조립·캐시·PNU 해석 (오케스트레이션) |
| `apartment.ts` | 234 | 아파트 조회 흐름 |
| `normalize.ts` | 137 | 응답 파싱·정규화 (순수) |
| `detached-house.ts` / `notice-date.ts` / `params.ts` / `cache.ts` | 40~126 | 각 1책임 |

계산(순수)/수집(I/O)/표현이 파일 단위로 갈려 있고, `params.ts`·`normalize.ts`는
`fetch`·`Date.now()`를 참조하지 않는다. `index.ts:103`의 `Date.now`는 **주입 가능한 의존성**으로
받아 두었다(`dependencies.now ?? Date.now`) — R3가 요구하는 형태다.

R1도 문제없다. `apartment.ts:133-234`는 전부 early return 가드절이고 중첩이 없다.
282줄인 `index.ts`가 300줄 신호에 근접하지만 클래스 하나의 응집된 책임이라 **지금 쪼갤 필요는 없다.**

다만 `normalize.ts`는 이름 정규화(`:33-47`)·행 검증(`:80-102`)·이력 변환(`:104-130`)·
결과 생성자(`:132-137`)가 한 파일에 있다. 137줄이라 당장 문제는 아니나, F4를 고치면서
이름 정규화를 공통 모듈로 뽑을 때 자연스럽게 갈라진다.

---

## R4 — 트랜잭션 / 부분 실패 → 🟡 부분 충족

### "검증 미달 시 기존 데이터 유지" → ✅ **성립한다** (실행 경로 추적 완료)

이름이 아니라 경로를 따라 확인했다.

1. 수집 중 쓰기는 전부 **`complex_staging`** 으로 간다
   (`scripts/lib/d1-complex.ts:340-355` `upsertComplexRecords` → `complex_staging`).
   라이브 `complex`는 이 단계에서 **한 번도 건드리지 않는다.**
2. `scripts/ingest-complexes.ts:405`의 활성화 조건은
   `maxLookups === undefined && failureReason === null`.
3. `failureReason`은 `:391-402`에서 **커버리지 가드 / 거부율 가드 / `complete` / 필수 지역 표본**
   중 하나라도 실패하면 non-null이 된다. `complete`(`:380-388`)는 건수 일치·pending 0·
   지오코딩 일치·실패 0을 모두 요구한다.
4. 따라서 검증이 미달이면 `activateStaging()`은 **호출되지 않고** `complex`는 그대로 남는다.
   `:452`에서 throw 하며 종료한다.

`:391-402`가 `else if` 체인이라 **메시지**는 첫 실패 사유만 나오지만, 활성화 차단은
어느 가지든 동일하게 걸린다. 논리적 구멍 없음. **부분 적재 상태가 노출되는 경로는 없다.**

멱등성도 확인했다. `COMPLEX_ACTIVATION_SQL`(`:431-466`)은 `ON CONFLICT DO UPDATE` +
`DELETE ... WHERE NOT EXISTS` 구조라 중복 실행이 데이터를 망가뜨리지 않는다.
`tests/d1-complex-activation.test.ts:63-87`이 `rowid` 보존과 FK 캐스케이드까지 검증한다.

### F9. 원자성 근거 주석이 `--remote` 경로에서 사실과 다르다 — **CONFIRMED** 🟠

`scripts/lib/d1-complex.ts:472-473`:

```ts
// Wrangler maps the semicolon-separated statements to one D1 batch. D1 batches
// are transactions, so the upsert and delete-missing steps commit together.
```

`activateStaging`은 `input`을 지정하지 않으므로 `runD1`의 기본값 `'command'`가 쓰이고
(`scripts/lib/d1.ts:36`), `wrangler d1 execute ... --command "<sql>"`로 실행된다.
wrangler 4.118.0 소스를 따라가면 두 경로가 **완전히 다르다**:

| 경로 | wrangler 동작 | 원자성 |
|---|---|---|
| `--local --command` | `splitSqlQuery()` → `db.batch(...)` (`cli.js:301095-301101`) | ✅ 배치 = 트랜잭션 |
| **`--remote --command`** | `d1ApiPost(..., "query", { sql })` — **분할하지 않고 문자열 그대로 POST** (`cli.js:301232-301241`) | ❓ **보장 없음** |
| `--remote --file` | R2 업로드 → import 인제스트. wrangler가 명시적으로 롤백을 보장 | ✅ |

즉 주석이 서술하는 메커니즘("wrangler가 배치로 매핑한다")은 **프로덕션에서 쓰는
`--remote --command` 경로에 존재하지 않는다.** wrangler는 그 경로에서 `splitSqlQuery`를
아예 호출하지 않는다. 원자성 여부는 Cloudflare `/query` 엔드포인트의 서버측 구현에 달려 있고,
이는 문서화된 계약이 아니다.

**테스트가 이걸 잡지 못하는 이유도 확인했다.** `tests/d1-complex-activation.test.ts:67`은

```js
database.exec(`BEGIN; ${COMPLEX_ACTIVATION_SQL} COMMIT;`)
```

**테스트가 트랜잭션을 스스로 감싼다.** 프로덕션 코드에는 `BEGIN`/`COMMIT`이 없다.
테스트는 "이 SQL이 트랜잭션 안에서 옳게 동작한다"만 증명하고 "프로덕션이 트랜잭션을 쓴다"는
증명하지 않는다.

**실패 결과.** UPSERT가 커밋되고 `DELETE ... WHERE NOT EXISTS`가 실행되지 않으면(요청 중단·
서버측 비원자 실행), `complex`에 신규·갱신분은 반영되고 **원본에서 사라진 단지가 남는다.**
지도에 이미 없어진 단지가 계속 뜬다. 데이터 파손은 아니고 재실행으로 복구되지만,
"부분 적재된 상태가 사용자에게 노출되면 안 된다"(AGENTS §3 R4-a)는 요건은 깨진다.

**권고.** 둘 중 하나. (a) `input: 'file'`로 바꿔 `--remote`에서 검증된 import 경로를 타게 한다.
(b) SQL을 `BEGIN IMMEDIATE; ... COMMIT;`으로 감싸고 테스트에서 래핑을 제거해
**프로덕션과 동일한 문자열**을 검증한다. (b)가 변경 폭이 작다.

### F10. 최소 기대 건수에 절대 하한이 없다 — **CONFIRMED** 🟡

`scripts/ingest-complexes.ts:382`의 건수 검증은 전부 `verification.totalCount` **상대값**이고,
그 값은 `--verification`으로 넘긴 JSON 파일(`:68-101`)에서 온다.
현재 라이브 `complex` 행 수와 비교하는 코드도, 절대 하한 상수도 **없다.**

**실패 결과.** 외부 API가 일시적으로 축소된 `totalCount`를 반환한 상태에서 만들어진
검증 아티팩트를 쓰면(또는 낡은 아티팩트를 재사용하면), 예컨대 `totalCount = 40`으로
스테이징 40건이 채워지고 `complete`가 참이 된다. `requiredRegionsPresent`는 서울·부산·경기·제주에
1건씩만 있으면 통과하므로 40건으로도 만족 가능하다. 그러면
`COMPLEX_ACTIVATION_SQL:461-466`의 `DELETE ... WHERE NOT EXISTS`가 **22,259건을 40건으로
지워버린다.** 전국 지도가 사실상 비워진다.

`MAX_SOURCE_EXCLUSION_RATIO`(`:40`)는 제외 비율만 막고 총량 붕괴는 막지 못한다.

**권고.** 활성화 직전에 `SELECT COUNT(*) FROM complex`와 비교해 감소폭이 임계치(예: 5%)를
넘으면 중단. 또는 `MINIMUM_EXPECTED_COMPLEX_COUNT` 절대 하한.
(참고: `worker/ldong/refresh.ts:14`의 `MINIMUM_REGION_CODE_COUNT = 15_000`이 이미
같은 종류의 방어를 하고 있다 — 단지 마스터에만 없다.)

### 외부 API 다건 조회 (R4-b) → ✅ 양호

- `worker/realty-price/index.ts:107-117` `lookupBatch`는 건별 결과를 배열로 반환한다.
  한 건 실패가 전체를 버리지 않는다 ✅
- 조회 실패와 자료 없음을 구분한다: `status: 'failed'`(+`retryable`) vs `status: 'noData'`
  (`shared/official-price.ts`, `normalize.ts:132-137`) ✅
- 타임아웃·재시도 상한 존재: `client.ts:7-9` (10초, 3회 백오프) ✅
- **"세액 계산은 부분 데이터로 수행하지 않는다"** — 현재 `calculateHoldingTax`/
  `calculateTransferTax`는 **아직 UI에서 호출되지 않는다**(테스트에서만 호출).
  P4-3이 계산 오버레이를 붙이는 중이므로 이 요건은 **그 시점에 재확인이 필요하다.**
  `src/holding/validation.ts:72-78`이 `officialPrice`를 필수 정수로 강제하고
  `calc.ts:49-50`이 `calculationStatus: 'missingInputs'`를 반환하는 골격은 갖춰져 있다. **SUSPECTED —
  미검증**(호출부가 없어 증명 불가).

---

## 조치 우선순위 제안

| 순위 | 항목 | 이유 |
|---|---|---|
| 1 | **F1** | 이미 모순 상태. `geocode:complexes`가 현재 데이터에서 동작 불가 |
| 2 | **F9** | 원자성 근거가 틀렸고 테스트가 그것을 가려 준다 |
| 3 | **F10** | 발생 확률은 낮으나 결과가 전국 데이터 소실 |
| 4 | **F2**, **F4** | 검증 게이트·공시가격 해석에 직결되는 중복 |
| 5 | **F3** | 골든 케이스 권위 규정과 맞물려 잘못된 반려를 유발 |
| 6 | **F8** | F1이 테스트로 안 잡힌 구조적 원인 |
| 7 | F5, F6, F7 | 드리프트 대기 상태. 지금은 무해 |

F1·F2·F8은 **한 태스크로 묶는 편이 낫다** — 게이트 평가를 순수 함수 한 곳으로 모으면
셋이 동시에 해소된다.

---

## 감사 범위와 한계

- **읽은 것**: `src/rules/` 14파일 전체, `src/holding/`·`src/transfer/` 전체,
  `worker/realty-price/` 전체, `worker/trade/` 주요 6파일, `worker/ldong/`,
  `scripts/ingest-complexes.ts`·`geocode.ts`·`lib/d1*.ts`, `src/styles/tokens.css` 및 전체 CSS,
  `docs/` 5파일의 해당 절, wrangler 4.118.0의 `d1 execute` 구현
- **정규식 스캔은 재실행하지 않았다.** 중복 식별자 목록은 선언 위치를 기계적으로 모은 뒤
  **각 쌍의 본문을 직접 대조해** 판정했다 — 이름만 같은 경우(`TRADE_PAGE_SIZE`는 UI 6건 vs
  API 1,000건으로 의미가 다르다)는 findings에서 제외했다
- **실행하지 않은 것**: `npm test`·`typecheck`·`lint`를 돌리지 않았다(리뷰 과제 범위 밖이며,
  P4-3이 동시에 소스를 수정 중이라 결과가 오염된다)
- **증명하지 못한 것**: F9에서 Cloudflare `/query` 엔드포인트의 서버측 원자성 여부.
  wrangler가 배치로 보내지 **않는다**는 것까지만 확인했다
- 소스 파일은 **하나도 수정하지 않았다.** 이 보고서만 새로 만들었다
