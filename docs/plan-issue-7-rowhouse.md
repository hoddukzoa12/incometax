# #7 연립·다세대 보유세 계산 지원 — 구현 계획

> 확정일: 2026-08-14
> 관련 이슈: #7, #6(개별주택 — 입력 경로만 통합)
> Fable 리뷰: 2차 완료 (2026-08-14)

---

## 설계 결정

| 결정 | 내용 | 근거 |
|---|---|---|
| AssetKind | `'rowhouse'` 추가 안 함. `'apartment'` = 공동주택 | 세율 분기 없음, realtyprice.kr API 동일, 캐시 키 사고 위험 회피 |
| UI 라벨 | `'아파트'` → `'공동주택'`으로 변경, 또는 표시용 필드 추가 | 연립·다세대도 '아파트' 라벨은 부자연스러움 |
| 검색 UI | 기존 검색창 하나로 통합 (D1 + 카카오 주소 + 카카오 키워드) | 사용자가 유형을 몰라도 됨 |
| 검색 필터링 | 검색 단계에서 건물 용도 필터 없음 — realtyprice.kr 조회가 자연 필터 | 카카오 API에 건물 용도 정보 없음 |
| 실거래가 | 온디맨드 조회, D1 적재 안 함 | 단지 레코드 없음, 실시간 API로 충분 |
| 실거래가 매칭 | 기존 `matchTrade` 로직 그대로 사용 — 새 규칙 만들지 않음 | 기존 다중 후보 분기가 이미 처리 |
| #6 통합 | 주소 입력 경로 공유, PNU 조회 후 공동주택/개별주택 자동 분기 | 입력 UI 중복 방지 |
| 개별주택 분기 | 빈 성공 응답 시 **사용자 확인** 후 전환 (자동 전환 금지) | CAPTCHA/장애와 구분 불가 → 세금 근거 오류 방지 |

---

## 통합 검색 흐름

```
사용자 입력 (기존 검색창 — "단지명, 주소, 건물명")
  ├─ D1 검색 (기존) ──────── K-apt 단지 결과 → 기존 아파트 흐름
  ├─ 카카오 주소 검색 (신규) ── 주소 결과 ─┐
  └─ 카카오 키워드 검색 (신규) ─ 장소 결과 ─┤
                                            └─ 선택 → PNU 변환 → realtyprice.kr 공동주택 검색
                                                 ├─ 성공 + 결과 있음 → 단지 선택 → 동/호 → 포트폴리오 추가
                                                 ├─ 성공 + 결과 없음 → 개별주택 조회 → 있으면 확인 후 #6, 없으면 안내
                                                 └─ 실패 (CAPTCHA/장애) → 오류 표시, 재시도 안내
```

realtyprice.kr 조회가 자연 필터 역할: 검색 단계에서 건물 용도를 걸러내지 않고,
선택 후 공동주택/개별주택 데이터 유무로 분기한다.

**D1 중복 대조**: 주소 경로로 선택한 물건의 PNU가 D1 complex에 존재하면,
기존 아파트 흐름으로 라우팅한다 (같은 물건에 두 ID가 생기는 것을 방지).

포트폴리오 아이템: `assetKind: 'apartment'`, `complexId: null`, `pnu|aptCode`를 합성 키로 사용.

---

## 태스크 분해

### T1. 선택 identity 계약 정의 + shared 타입

**목표**: 주소 경로로 찾은 공동주택의 식별 체계 확정

- 선택 identity 유니온 정의:
  ```
  { origin: 'kapt', complexId: string }
  | { origin: 'address', pnu: string, aptCode: string, complexName: string,
      legalDongCode: string, lat: number, lng: number }
  ```
- `PortfolioItemSeed`에 `pnu`, `aptCode` 필드 추가 (nullable)
- 주소 경로 아이템의 합성 키: `pnu|aptCode` — 거래 캐시·중복 판별에 사용
- T2·T3·T4의 요청/응답 타입 정의
- `src/messages/portfolio.ts`의 `apartment` 라벨 결정 ('공동주택' 또는 표시용 필드)
- `shared/official-price.ts`에 API 계약 추가 (주소 기반 단지 검색)
- 카카오 `addressSearch`의 구조화 필드(`b_code`, 본번/부번)로 PNU 직접 도출 가능 — T2 입력 계약에서 구조화 경로 우선 명시 (`keywordSearch`는 텍스트 전용이므로 `parseLotAddress` 경유)

**편집 범위**: `shared/` 전용

### T2. Worker — 주소 기반 공동주택 검색 엔드포인트

**목표**: 주소 → PNU → realtyprice.kr 공동주택 목록 반환

- `POST /api/address/complexes`
- 입력: `{ address: string, pnu?: string }` — PNU가 있으면 직접 사용, 없으면 `addressToPnu`로 변환
- 처리: PNU 변환 → `searchApt.search` (기존 `apartmentParams` 재활용)
- 응답: `{ status: 'found', complexes: [{code, name}], pnu }` 또는 에러 종류 구분
- **captcha/unavailable을 빈 목록과 구분** — 프론트에서 개별주택 분기 판단의 전제
- 응답 캐시: PNU+고시일자 키, Worker Cache API, 24시간

**편집 범위**: `worker/`, `shared/` (응답 타입)

### T3. Worker — complexId 없이 동/호 조회

**목표**: D1 의존 없이 unit-options 제공

- 새 엔드포인트: `POST /api/address/unit-options`
- 입력: `{ pnu, aptCode, dong? }`
- 기존 `lookupApartmentUnitOptions` 내부 로직 재활용 (PNU+aptCode로 직접 진입)
- 공시가격 조회: `/api/realty-prices` (기존 배치 엔드포인트)가 이미 address+aptCode 지원 → 변경 불필요

**편집 범위**: `worker/`

### T4a. Worker — 연립다세대 실거래가 데이터셋 fetch + 캐시

**목표**: `RTMSDataSvcRHTrade` 온디맨드 조회 인프라

- 기존 `fetchTradeDataset`이 `source` 파라미터로 `rowhouse` 지원 (이미 동작)
- 캐시 키: `source|LAWD_CD|YYYYMM` (같은 구의 연립 거래를 공유)
- Worker Cache API, 24시간 TTL
- in-flight 중복 방지 (같은 데이터셋 동시 요청 병합)
- 기존 아파트 온디맨드 경로(per-complexId D1 캐시)는 변경하지 않음 — 후속 통합은 별도

**편집 범위**: `worker/trade/`

### T4b. Worker — 연립다세대 실거래가 엔드포인트 + 매칭

**목표**: 주소+단지명으로 실거래가 매칭

- D1 complex 의존 제거 — 주소/법정동코드 + 단지명으로 후보 구성
- `prepareComplexCandidate`를 카카오 지번주소 + realtyprice 단지명으로 호출
- **기존 `matchTrade` 로직 그대로 사용** — 새 매칭 규칙을 만들지 않음
  - T2가 반환하는 PNU의 전체 단지 목록을 후보로 넘김
  - 기존 다중 후보 분기(matching.ts `sameLot.length > 1` → `uniqueNamedCandidate`)가 다중 빌라 필지를 처리
  - ~~buildingName 불일치 시 매칭 제외~~ (삭제 — GR2 현대빌라(693-15)에서 이름 suffix 차이로 매칭 실패하는 버그 유발)
- 거래 매칭률 로깅 (`TradeDatasetStats` 기존 패턴 재활용)

**선행**: T0 추가 검증 (GR2 거래 매칭, 다중 빌라 필지 케이스)

**편집 범위**: `worker/trade/`

### T5. Frontend — 검색 통합 (D1 + 카카오 주소 + 카카오 키워드)

**목표**: 기존 검색창 하나로 단지명·주소·건물명 모두 검색

- `ComplexSearch` 수정: 250ms 디바운스 후 **3개 소스 병렬** 실행
  1. D1 검색 (기존) → 아파트 단지명 매칭
  2. 카카오 `addressSearch` → 도로명/지번 주소 매칭
  3. 카카오 `keywordSearch` → 건물명/장소명 매칭 (예: "현대빌라")
- 결과를 섹션별로 표시 (단지 / 주소·장소), 독립 로딩 상태
- 키보드 내비게이션: 그룹 간 화살표 이동 (ARIA listbox 유지)
- D1 결과 선택 → 기존 아파트 흐름
- 주소/장소 결과 선택 → 좌표·주소 확보 → T2 API → 공동주택 단지 목록 표시
- 카카오 검색은 클라이언트 SDK 직접 사용 (Worker 불필요)
- 키워드 결과에 음식점·상가 등이 포함될 수 있으나 **검색 단계에서 필터링하지 않음**
  — 선택 후 realtyprice.kr 조회가 자연 필터 역할 (공동주택 데이터 없으면 안내 메시지)

**의존**: T1 (선택 identity 타입). T2-T4와 병렬 가능.

**편집 범위**: `src/search/`, `src/shell/`

### T6. Frontend — 주소/장소 선택 후 사이드바 (아파트와 동일 UX)

**목표**: 검색 결과 선택 → 지도 마커 → 사이드바 → 동/호 → 포트폴리오 추가

선택 후 동작은 기존 아파트와 동일하게:
1. 지도 중앙 이동 + 마커 표시 (카카오 검색 좌표 사용)
2. 사이드바 열림: 단지명(realtyprice.kr 응답), 주소, 동/호 선택, 공시가격, 실거래가
3. 포트폴리오 추가 가능

아파트와 다른 부분만 처리:
- 좌표: D1이 아닌 카카오 검색 결과에서 가져옴
- 단지명: realtyprice.kr 응답의 `name` 필드
- 세대수·동수: D1에 없으므로 표시 생략
- **동이 1개면 자동 선택** (동명 `"동명없음"` 등 → UnitPicker 동 단계 스킵)
- 실거래가: `apt` + `rowhouse` 소스 둘 다 조회

D1 중복 대조:
- 주소 경로로 선택한 PNU가 D1 complex에 존재하면 → 기존 아파트 흐름으로 라우팅
- 같은 물건에 `complexId: null` / `complexId: 'xxx'` 두 ID가 생기는 것을 방지

분기 로직:
- T2 결과에 공동주택이 있으면 → 단지 선택(복수 시) → 사이드바
- T2 결과 없음 (성공 + 빈 목록):
  - 개별주택 조회 시도 → 있으면 "개별주택으로 조회할까요?" (사용자 확인, #6)
  - 개별주택도 없으면 → "이 주소에서 주택 공시가격을 찾을 수 없습니다" 안내
  - **개별주택 조회도 CAPTCHA/장애와 빈 응답을 구분** — 장애를 "주택 없음"으로 오인 금지
- T2 실패(captcha/장애) → 오류 표시, 재시도 안내

기술:
- `PortfolioItemSeed` 생성: `assetKind: 'apartment'`, `complexId: null`, pnu+aptCode 포함
- `UnitPicker`/`UnitLookup` 리팩터: complexId 의존 제거, pnu+aptCode 경로 추가

**의존**: T2, T3, T5

**편집 범위**: `src/sidebar/`, `src/shell/`, `src/map/`

### T7. Frontend — 주소 경로 실거래가 표시

**목표**: 사이드바에 연립다세대 실거래가 표시

- T4b 엔드포인트 호출
- `isRecentTrade` 검증에서 `source === 'apt'` 하드코딩 → `TRADE_SOURCES` 멤버십 체크로 변경 (`src/sidebar/api.ts:63`)
- 기존 실거래가 UI 컴포넌트 재활용

**의존**: T4b, T6

**편집 범위**: `src/sidebar/`

---

## 태스크 의존관계

```
T0 추가검증 ─────────────────────────→ T4b
T1 (타입 계약) → T2 (단지 검색) ──────→ T6 (사이드바)
              → T3 (동/호 조회) ──────→ T6
              → T4a (거래 fetch) → T4b (매칭) → T7 (거래 표시)
              ∥ T5 (검색 통합) ───────→ T6
```

- T1 이후 T2·T3·T4a·T5는 병렬 가능
- T4b만 T0 추가 검증 대기 — 나머지는 즉시 디스패치 가능
- 의존 체인 최대 깊이: 4단계 (T1 → T4a → T4b → T7)

---

## 선행 작업 (T0): 골든 케이스 확보

### 완료 (2026-08-13)

- realtyprice.kr `searchApt.search`: 3개 다세대 주소 검증 (GR1~GR3)
- `RTMSDataSvcRHTrade`: 강남·서초 3개월 검증, GR1 거래 매칭 확인
- 응답 구조 아파트와 동일, 기존 코드 변경 불필요 확인

→ `docs/golden-cases-rowhouse.md`

### 추가 필요 (T4b 디스패치 전)

1. **GR2(현대빌라 693-15) 거래 매칭 검증**: 단지명 suffix `(693-15)` 있는 케이스에서 기존 `matchTrade`가 정상 매칭하는지 확인
2. **다중 빌라 필지 케이스**: 같은 PNU에 여러 공동주택이 등록된 주소를 찾아 매칭 정확도 확인
3. **GR3(서초동 PLUSHOUSE) 거래 확인**: 5호짜리 소규모 다세대에 거래가 없으면 "거래 없음"을 기대값으로 기록

---

## 범위 밖

- 개별주택 공시가격 조회 UI (#6 — T6에서 분기점만 만들고 실제 흐름은 별도)
- 오피스텔 (공시가격이 국세청 기준시가로 다른 경로 — 미지원 안내 메시지로 대응)
- UI 라벨 세부 디자인
- 아파트 온디맨드 거래 캐시 통합 (현재 per-complexId D1 캐시 → 후속)
