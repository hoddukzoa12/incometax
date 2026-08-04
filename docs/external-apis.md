# 외부 API 계약

P1(데이터 파이프라인)·P3(공시가격)이 의존하는 외부 원천의 실제 계약을 정리한다.

대부분이 **공식 문서가 없는 비공개 엔드포인트**다. 여기 적힌 내용은
`hoddukzoa12/iros-property-lookup`의 검증된 구현에서 추출했다. 추측이 아니라 동작하는
코드에서 왔지만, **원천이 예고 없이 바뀔 수 있다**는 전제로 설계한다.

규칙은 [AGENTS.md](../AGENTS.md), 특히 R4-b(부분 실패)를 따른다.

---

## 0. 위험도 분류

| 원천 | 공식 여부 | 인증 | 위험도 | 쓰는 곳 |
|---|---|---|---|---|
| 행안부 행정표준코드 | **공식** | data.go.kr 키 | 낮음 | P1·P3 (주소→PNU) |
| 국토부 실거래가 | **공식** | data.go.kr 키 | 낮음 | P1 (지도 라벨) |
| 국토부·부동산원 공동주택 단지 | **공식** | data.go.kr 키 | 낮음 (**검증 완료**) | P1 (단지 마스터) |
| 카카오 로컬 | **공식** | 카카오 REST 키 | 낮음 | P1 (지오코딩 배치) |
| 부동산공시가격알리미 | **비공식** | 없음 | **높음** | P3 (공시가격) |
| 국세청 홈택스 | **비공식** | HMAC 서명 | **매우 높음** | 보류 (§7) |

비공식 원천은 **캐시 우선, 실패 허용** 설계로 간다. 사용자 요청 경로에서 원천이 죽으면
서비스 전체가 죽지 않도록 한다.

---

## 1. 법정동코드 → PNU (행정안전부)

주소를 PNU로 바꾸는 것이 모든 조회의 전제다. **네트워크 호출 없이 오프라인 계산**한다.

```
GET https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList
인증: DATA_GO_KR_SERVICE_KEY (data.go.kr 일반 인증키)
```

### PNU 구성 (19자리)

```
PNU = 법정동코드(10) + 필지구분(1) + 본번(4) + 부번(4)
      필지구분: 1 = 일반, 2 = 산
      본번·부번: 왼쪽 0 패딩
```

### 주소 파싱 규칙

```
"서울특별시 강남구 역삼동 736-1"  →  동명 "서울특별시 강남구 역삼동" + 본번 736 + 부번 1
"... 산 15-3"                    →  필지구분 2
"265번지"                        →  "번지" 제거, 부번 0
```

지번 시작 토큰은 `산` 또는 `산?\d`로 판별한다. 하이픈은 유니코드 변형(‐‑‒–—−)을
전부 `-`로 정규화한다.

### 캐시 갱신

전량 수집 → **검증 통과 시에만 KV 교체** (R4-a).

| 검증 | 기준 |
|---|---|
| 최소 건수 | 15,000건 미만이면 실패 |
| 필수 표본 | 미리 정한 기준 코드가 기대값과 일치해야 함 |

갱신 실패 시 **기존 캐시를 유지**한다. 갱신 실패가 서비스 중단이 되면 안 된다.

**실응답 검증 완료 (2026-08-04).** 활성 법정동코드 전국 전량은 20,560건이었고,
필수 표본 `서울특별시 종로구 청운동 → 1111010100`이 일치했다. 검증 뒤 KV 스냅샷을
한 번만 교체했으며, 이어 최소 건수 미달 응답을 강제로 주입했을 때 갱신은 실패하고
직전 스냅샷의 바이트가 그대로 유지되는 것도 확인했다.

| 트리거 | 조건 |
|---|---|
| 정기 | 매일 04:00 KST Cron |
| 부트스트랩 | KV가 비어 있으면 백그라운드 1회 |
| TTL | 3일 초과 시 요청 중 백그라운드 재빌드 (응답은 막지 않음) |

### 실패 모드

| 상황 | 반환 |
|---|---|
| 주소 파싱 실패 (지번 토큰 없음) | `null` |
| 동명이 캐시에 없음 | `null` |

둘 다 **정상 결과**다. 재시도 대상이 아니다.

---

## 2. 공동주택가격 (부동산공시가격알리미) — 비공식

```
BASE: https://www.realtyprice.kr
```

### 필수 헤더

이게 없으면 거부된다.

```
accept:           application/json, text/javascript, */*; q=0.01
referer:          https://www.realtyprice.kr/notice/town/nfSiteLink.htm
x-requested-with: XMLHttpRequest
user-agent:       (브라우저 형태)
```

개별주택가격은 referer가 다르다 → `/notice/hpindividual/search.htm`

### 호출 제한

| 항목 | 값 |
|---|---|
| 동시성 | **1** (직렬) |
| 최소 호출 간격 | **260ms** |
| 재시도 지연 | 450ms → 1,000ms → 1,800ms (3회) |
| 재시도 대상 | **400**, 429, 5xx |

> `400`이 재시도 대상인 점에 주의. 이 서버는 과부하 시 400을 돌려준다.

### 조회 흐름 — 4개 논리 단계를 순차로 타야 한다

```
1. /notice/town/searchNoticeDate.search      { year }          → 고시일자 목록
2a. /notice/search/searchApt.search          + 단지 파라미터    → 단지 목록
2b. /notice/search/searchApt.search          + apt_code,
                                               gbnApt='DONG'    → 동 목록
3. /notice/search/searchApt.search           + dong_code       → 호 목록
4. /notice/search/townPriceListPastYearMap.search
       + gbnApt='HO', apt_code, dong_code, ho_code             → 가격
```

2단계가 단지 선택과 동 선택의 두 HTTP 요청으로 나뉘므로, 실제 호출 수는 총 5회다.

**동/호를 특정하지 않으면 가격이 나오지 않는다.** 단지 대표 공시가격이라는 개념이 없다
(층·향·면적마다 다름). 동/호 목록은 2b·3단계가 주므로 드롭다운으로 제공하면 된다.

### 연도별 가격 — `past_yn`

**확인 완료 (2026-08-04).** 공통 파라미터에 `past_yn: '1'`을 넣어 4단계 엔드포인트를
호출하면 과거 연도 가격이 한 번에 반환된다. 검증 대상은 `서울특별시 강남구 대치동 316`
은마아파트 1동 101호(`apt_code=1381`, `dong_code=1`, `ho_code=10`)였다. 실제 응답은
21건으로, 2026.1.1 공시가격 2,237,000,000원부터 2006.1.1 공시가격 542,000,000원까지
연도별 행을 포함했다. 응답에는 `model.list`와 `modelMap.list`가 모두 있었고 내용은 같았다.

따라서 **가격 조회에 요청 연도 인자를 추가하지 않는다.** 최신 고시일자를 한 번 구해
동·호를 선택한 뒤 `townPriceListPastYearMap.search`가 돌려주는 전체 연혁을 사용한다.
`latestNoticeDate()`는 최신 고시일자 하나를 메모이즈해도 되며, 실패한 Promise만 캐시에서
제거해 다음 요청이 재시도할 수 있게 한다.

### 응답 형태

```jsonc
// 두 형태가 모두 나온다. 반드시 둘 다 처리할 것.
{ "model":    { "list": [...], "totalCnt": 12 } }
{ "modelMap": { "list": [...], "totalCnt": 12 } }
```

### ⚠️ 최대 위험 — CAPTCHA

공통 파라미터에 다음이 포함되어 있다.

```
capcha, capcha_chk_yn, recaptcha_token
```

현재는 빈 값으로 통과하지만, **원천이 언제든 CAPTCHA를 켤 수 있다는 뜻이다.**
켜지면 이 경로는 즉시 막힌다.

설계 요구사항:
- 공시가격 조회 실패가 **서비스 전체 실패가 되면 안 된다**
- 조회된 공시가격은 캐시한다. 같은 동/호를 반복 조회하지 않는다
- CAPTCHA 감지 시 사용자에게 **원천 문제임을 명시**한다. 우리 버그처럼 보이면 안 된다

---

## 3. 개별주택가격 (부동산공시가격알리미) — 비공식

단독·다가구 주택용. **동/호가 없다.** 필지 단위라 주소만으로 조회된다.

```
/notice/search/hpiSearchListApi.search
referer: https://www.realtyprice.kr/notice/hpindividual/search.htm
```

주요 파라미터: `reg`(법정동코드 앞 5), `eub`(뒤 5), `san`(1 일반 / 2 산),
`bun1`·`bun2`(본번·부번, **0 패딩**), `from_year`·`to_year`(빈 값 = 전체)

### 응답 필드

| 필드 | 의미 |
|---|---|
| `base_ymd` | 기준일 |
| `full_addr_name` / `addr` | 주소 |
| `hprice_w` | **주택가격(원)** |
| `tbook_area` / `calc_larea` | 토지면적 (대장 / 산정) |
| `bldg_garea` / `res_area` | 건물면적 (연면적 / 주거) |

`base_ymd` 내림차순 정렬하면 연도별 가격을 얻는다.

---

## 4. 실거래가 (국토교통부 / data.go.kr) — 공식

**P1에서 D1에 캐시한다. 사용자 요청 경로에서 직접 호출하지 않는다.**

```
아파트      https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade
연립다세대  https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade
오피스텔    https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade
```

| 항목 | 값 |
|---|---|
| 파라미터 | `LAWD_CD`(법정동코드 **앞 5자리**), `DEAL_YMD`(YYYYMM), `pageNo`, `numOfRows`, `serviceKey` |
| 페이지 크기 | 1,000 |
| 최대 페이지 | 10 |
| 조회 범위 | 최근 **13개월** (offset 0~12) 순회 후 최근 1년으로 필터 |
| **응답 형식** | **XML** (JSON 아님) |

### ⚠️ 해제된 거래 제거 — 반드시 구현

실거래가에는 **계약 해제된 거래가 그대로 남아 있다.** 이걸 빼지 않으면 존재하지 않는
거래가 지도에 뜬다.

```
해제 판정: raw.cdealType === 'O'  또는  raw.cdealDay 존재
```

그리고 **해제 건만 지우면 안 된다.** 해제 건과 동일한 원거래도 함께 제거해야 한다.
동일성 판정 키:

```
source | 법정동 | 지번(정규화) | 건물명 | 주택유형 | 층 | 면적
       | 대지면적 | 연면적 | 거래일 | 거래금액
```

### ⚠️ 단지 매칭 — P1 최대 난관

이 API는 **아파트명·지번·법정동**을 주고, 단지 마스터는 **단지코드·단지명·주소**를 갖는다.
이름이 정확히 일치하지 않는다 (`래미안` vs `래미안아파트`).

`iros-property-lookup/worker/trade/`에 이미 구현이 있다.

| 함수 | 역할 |
|---|---|
| `normalizeJibun` | 하이픈 변형·"번지" 제거 정규화 |
| `matchesDong` | 법정동 일치 |
| `matchTrade` | `'lot'`(지번 일치) / `'candidate'`(후보) 등급 판정 |

**매칭률을 로그로 남긴다.** 매칭 실패 건이 조용히 사라지면 지도에 구멍이 생긴다.

---

## 5. 공동주택 단지 목록 (국토교통부·한국부동산원) — 공식

**실응답 검증 완료 (2026-08-04).** 세 API의 응답을 직접 호출했고, 페이지를 끝까지
순회해 전국 건수와 좌표 포함 여부를 확인했다.

### K-apt 단지 목록 — P1 마스터 원천

```
GET https://apis.data.go.kr/1613000/AptListService3/getTotalAptList3
파라미터: serviceKey, pageNo, numOfRows
```

응답은 `response.header`와 `response.body` 봉투이며, 페이지 정보는
`body.pageNo`·`body.numOfRows`·`body.totalCount`, 목록은 `body.items[]`에 있다.
`numOfRows=1,000`으로 23페이지를 순회한 결과 **총 22,259건**이었다.

| 실제 항목 필드 | 의미 |
|---|---|
| `kaptCode`, `kaptName` | 단지코드, 단지명 |
| `bjdCode` | 법정동코드 10자리 |
| `as1`, `as2`, `as3`, `as4` | 시도, 시군구, 읍면동, 리 (`as4`는 `null` 가능) |

목록 API에는 도로명주소가 없다. 각 `kaptCode`를 다음 기본 정보 API로 조회해야 한다.

### K-apt 단지 기본 정보 V4 — 코드별 보강

```
GET https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4
파라미터: serviceKey, kaptCode
```

페이지네이션 없는 단건 응답이며 `response.body.item`에 다음 필드가 있었다.

```
bjdCode, codeAptNm, codeHallNm, codeHeatNm, codeMgrNm, codeSaleNm,
doroJuso, hoCnt, kaptAcompany, kaptAddr, kaptBaseFloor, kaptBcompany,
kaptCode, kaptDongCnt, kaptFax, kaptMarea, kaptMparea60, kaptMparea85,
kaptMparea135, kaptMparea136, kaptName, kaptTarea, kaptTel, kaptTopFloor,
kaptUrl, kaptUsedate, kaptdEcntp, kaptdaCnt, ktownFlrNo, privArea, zipcode
```

P1 스키마에는 여기서 `kaptCode`, `kaptName`, `kaptAddr`, `doroJuso`, `bjdCode`,
`kaptUsedate`, `kaptDongCnt`, `kaptdaCnt`만 사용한다. 수치 필드는 응답에 따라 숫자 또는
숫자 문자열이므로 정수로 정규화한다.

### 한국부동산원 단지 식별정보 — 범위 비교용

```
GET https://api.odcloud.kr/api/AptIdInfoSvc/v1/getAptInfo
파라미터: serviceKey, page, perPage, returnType=JSON
```

응답 최상위에 `page`, `perPage`, `totalCount`, `currentCount`, `matchCount`, `data[]`가
있다. `perPage=1,000`으로 전량 순회한 결과 **총 307,407건**이었다. 실제 항목 필드는
`COMPLEX_PK`, `PNU`, `ADRES`, `COMPLEX_NM1`, `COMPLEX_NM2`, `COMPLEX_NM3`,
`COMPLEX_GB_CD`, `DONG_CNT`, `UNIT_CNT`, `USEAPR_DT`다.

이 원천은 3세대 규모 공동주택까지 포함해 K-apt보다 범위가 훨씬 넓고 도로명주소가 없다.
현재 P1의 지도 단지 마스터는 도로명주소와 K-apt 단지코드가 있는 **K-apt 22,259건**을
기준으로 삼고, 부동산원 원천은 범위 확장 시 다시 검토한다. 2024-09-13 기준 파일 데이터
`15073271`(18,403행)는 최신 배치 원천으로 쓰지 않는다.

### 좌표와 지오코딩 물량

K-apt 목록 22,259건 전체, K-apt 기본 정보 실응답, 부동산원 307,407건 전체에서
`lat`·`lng`·`x`·`y` 등 좌표 필드는 **한 건도 없었다.** 따라서 현재 P1 마스터
**22,259건 전부**를 §6의 카카오 로컬 API로 일괄 지오코딩해야 한다.

---

## 6. 지오코딩 (카카오 로컬 API) — 공식

단지 주소 → 좌표. **일회성 배치 전용.** 런타임 호출 금지 (AGENTS.md §2).

| 항목 | 값 |
|---|---|
| 인증 | 카카오 **REST API 키** (JavaScript 키 아님 — 혼동 주의) |
| 무료 한도 | 주소↔좌표 변환 100,000건/일 |
| 초과 요금 | 0.5원/건 |
| 좌표계 | WGS84 |

전국 단지가 수만 건 규모라 무료 한도 안에서 하루면 끝난다. 이후에는 신규 단지만 갱신한다.

> **확정: 이 프로젝트는 무료 쿼터 적용 대상이다.** 개발자 계정의 첫 활성화 앱이므로
> 비즈월렛 연결 없이 시작한다.
>
> 다만 한도가 무제한은 아니다. 지오코딩을 런타임에 호출하면 10만건/일을 쉽게 넘긴다.
> **배치 전용 원칙은 그대로 유지한다.**

---

## 7. 상가·오피스텔 기준시가 (국세청 홈택스) — **보류**

`iros-property-lookup`에 구현이 있으나 **이 프로젝트에서는 당장 쓰지 않는다.**

### 쓰지 않는 이유

**국세청 기준시가는 보유세 과세표준이 아니다.** 양도소득세·상속증여세 평가액이다.
재산세는 지자체 시가표준액(건물분) + 개별공시지가(토지분) 기준이고, 종부세 주택분은
주택 공시가격 기준이다. **보유세 계산에 넣으면 틀린다.**

양도세 쪽에서 취득가액 환산(기준시가 비율법)이 필요해지면 그때 도입한다.

### 참고 — 계약 (도입 시)

```
POST https://teht.hometax.go.kr/wqAction.do
     ?actionId=<ATESFAAA023R01~R06>&screenId=UTESFAAM13&popupYn=false
```

**HMAC-SHA256 서명이 필요하다.** 페이로드 봉투가 일반적인 형태가 아니다.

```
{JSON body}<nts<nts>nts>{초+11}{base64 MAC(영숫자만)}{초 2자리}
```

서명 키는 **하드코딩된 배열**이고 요청 시각의 `초 % 키개수`로 선택된다.
(키 값은 `iros-property-lookup/worker/commercial-price/index.ts` 참조)

> ⚠️ **가장 취약한 경로다.** 역공학된 서명 스킴이라 원천이 조금만 바꿔도 즉시 깨진다.
> 도입하더라도 실패를 정상 경로로 취급해야 한다.

응답 목록 필드: `cmrcTsvCmchInqrDVOList`, `roadNmAdrAdmDVOList`

---

## 8. 공통 구현 규칙

### 부분 실패 (R4-b)

```
다건 조회 → 건별 성공/실패 분리 반환. 한 건 실패가 전체를 버리지 않는다.
세액 계산 → 부분 데이터로 수행하지 않는다. 다주택 합산은 전부 있어야 성립한다.
```

일부가 없으면 계산을 중단하고 **어느 건이 왜 없는지** 사용자에게 알린다.

### 실패 유형을 구분한다

| 유형 | 예 | 처리 |
|---|---|---|
| **조회 실패** | 타임아웃, 5xx, CAPTCHA | 재시도 → 사용자에게 원천 문제 명시 |
| **자료 없음** | 해당 동/호에 공시가격 미등재 | **정상 결과.** 재시도 안 함 |

이 둘을 같은 에러로 뭉뜽그리면 사용자가 원인을 알 수 없다.

### 필수

- 모든 외부 호출에 **타임아웃**과 **재시도 상한**을 둔다. 무한 대기 금지
- 호출 간격·동시성 상한은 **이름 붙인 상수**로 둔다 (R2). 매직 넘버 금지
- 비공식 원천의 응답 스키마 변화를 감지할 수 있도록, 필수 필드 누락 시 명시적으로 실패한다.
  조용히 `null`을 흘려보내면 잘못된 세액이 나간다

---

## 9. 미확인 목록

P1·P3 착수 시 **먼저 실제 응답을 찍어 확인하고 이 문서를 갱신**한다.

확인 완료: `past_yn=1` / `townPriceListPastYearMap.search`의 과거 연도 반환 여부는
2026-08-04에 확인했다. 단일 호출이 여러 연도를 반환하므로 P3의 가격 조회는 연도별로
파라미터화하지 않는다(실응답은 §2).

확인 완료: 공동주택 API의 실응답·페이지네이션·전국 건수·좌표 부재는 2026-08-04에
확인했다. P1 마스터는 K-apt 22,259건이며 전량 지오코딩 대상이다(실응답은 §5).

| # | 항목 | 영향 |
|---|---|---|
| 4 | 실거래가 ↔ 단지 매칭률 | P1 성패. 낮으면 지도에 구멍 |
| 5 | realtyprice.kr CAPTCHA 발동 조건 | P3 리스크 |
