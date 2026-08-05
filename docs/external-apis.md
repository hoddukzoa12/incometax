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

### P4-2b 조사 결론 — 동·호 열거 가능 (2026-08-05)

`worker/realty-price/`의 실제 요청 조립과 응답 정규화, 전날 확인된 은마아파트 라이브
가격 체인을 기준으로 계약을 추적했다. 사이트 네트워크 캡처도 시작했으나 CAPTCHA 자산이
관측되어 아래 위험 기록 시점에 중단했고, 대체 원천은 공공데이터포털의 현재 공식 명세로
확인했다. 적재·배치 스크립트는 실행하지 않았다.

별도 `dongs`·`rooms` 엔드포인트가 있는 것은 아니다. 사이트가 단지·동·호 선택에
**같은 `GET /notice/search/searchApt.search`를 재사용**하고 `gbnApt`와 상위 선택 코드를
바꾸는 구조다. 이 목록은 공시가격 원천과 같은 데이터이므로 실거래가에서 추정한 목록보다
우선한다. 동 목록까지 새로 조회하면 3회, 특정 동의 호 목록까지면 4회, 가격까지면 5회다.
고시일자 요청은 프로세스 안에서 메모이즈할 수 있다.

공동 파라미터 중 값이 있는 항목은 다음과 같다. `reg`·`eub`는 PNU의 법정동코드 앞·뒤
5자리이고, `bun1`·`bun2`는 PNU 본번·부번의 0 패딩을 제거한 값이다.

```
page_no=1, gbn=1, year=<고시연도>, notice_date_year=<공시일 YYYYMMDD>,
reg=<시군구코드 5>, eub=<읍면동코드 5>, apt_name=<단지명>,
bun1=<본번>, bun2=<부번>, tabGbn=Text, print_yn=0, past_yn=1,
searchGbnBunji=1, init_gbn=N
```

사이트 폼과 동일하게 다음 키도 빈 문자열로 보낸다.

```
reg_name, sreg, seub, old_reg, old_eub, notice_date, road_code,
initialword, build_bun1, build_bun2, gbnApt, apt_code, dong_code,
ho_code, full_addr_name, dong_name, ho_name, notice_amt, ktown_ho_seq,
searchGbnRoad, searchGbnBunjiYear, capcha, capcha_chk_yn, recaptcha_token
```

| 단계 | 엔드포인트 | 공동 파라미터에 덮어쓰는 값 | 결과 |
|---|---|---|---|
| 고시일자 | `/notice/town/searchNoticeDate.search` | `year=<현재 연도>` | `code`, `name` |
| 단지 | `/notice/search/searchApt.search` | 없음 (`gbnApt=''`) | 단지 `code`, `name`, `notice_date` |
| 동 | `/notice/search/searchApt.search` | `notice_date`, `gbnApt=DONG`, `apt_code` | 각 동의 `code`, `name` |
| 호 | `/notice/search/searchApt.search` | `notice_date`, `gbnApt=HO`, `apt_code`, `dong_code`, `dong_name` | 각 호의 `code`, `name` |
| 가격 | `/notice/search/townPriceListPastYearMap.search` | 위 호 단계 값 + `ho_code`, `ho_name` | 선택 호의 연도별 가격 |

은마아파트 검증값은 `apt_code=1381`, 1동의 `dong_code=1`, 101호의
`ho_code=10`이다. **동/호를 특정하지 않으면 가격이 나오지 않으며 단지 대표
공시가격이라는 개념도 없다.** 따라서 UI는 동 목록을 받고, 선택된 동 코드로 호 목록을
받는 종속 드롭다운으로 구성한다.

### 다른 원천의 가능 범위와 부정 결과

| 원천 | 정확한 계약 | 가능한 것 | 불가능하거나 부족한 것 |
|---|---|---|---|
| K-apt 기본정보 V4 (§5) | `GET https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4` + `serviceKey`, `kaptCode` | `kaptDongCnt`·`kaptdaCnt`로 동/세대 **수** 확인 | 동명·호명 목록 없음. K-apt에는 별도 동/호 목록 operation이 없다 |
| 한국부동산원 단지 식별정보 | `GET https://api.odcloud.kr/api/AptIdInfoSvc/v1/getDongInfo` + `serviceKey`, `page`, `perPage`, `returnType=JSON`, `cond[COMPLEX_PK::EQ]` | `DONG_NM1`(공시가격), `DONG_NM2`(건축물대장), `DONG_NM3`(도로명주소), `GRND_FLR_CNT`로 동 열거 | 이 서비스의 operation은 `getAptInfo`·`getDongInfo`·`getHistInfo`뿐이다. `getHoInfo`/`getUnitInfo`는 없고 K-apt 코드와 `COMPLEX_PK`도 동일 키가 아니다 |
| 건축HUB 건축물대장 전유부 | `GET https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposInfo` + `serviceKey`, `sigunguCd`, `bjdongCd`, `platGbCd`, `bun`, `ji`, `pageNo`, `numOfRows`, `_type=json` | 필지의 전유부 행에 `dongNm`·`hoNm`이 있어 공식 원천으로 동/호 열거 가능 | 공시가격 단지와 건축물대장 명칭·기준시점이 다르고 여러 필지 단지는 추가 매핑이 필요하다. 별도 API 활용신청과 페이지 순회도 필요하므로 이번 조사에서는 구현하지 않았다 |
| 아파트 실거래가 (§4) | 기존 월별 거래 API. 동 필드는 소유권 이전등기 완료 건에만 조건부 공개 | 거래된 적 있는 동의 보조 힌트 | 호 필드와 전체 재고 목록이 없고, 미거래 동은 영원히 빠진다. 현재 저장소의 `trade` 스키마와 `RawTrade`는 동 필드도 저장하지 않는다 |

건축HUB의 PNU 변환은 `sigunguCd=PNU[0..5)`, `bjdongCd=PNU[5..10)`,
`bun=PNU[11..15)`, `ji=PNU[15..19)`이다. `platGbCd`는 일반 대지 `0`, 산 `1`이라
PNU 필지구분 `1`·`2`를 각각 `0`·`1`로 바꿔야 한다. 이 계약은
[공공데이터포털 건축HUB 명세](https://www.data.go.kr/data/15134735/openapi.do)에서
확인했다. 한국부동산원 동정보 계약은
[공동주택 단지 식별정보 명세](https://www.data.go.kr/data/15106817/openapi.do) 기준이다.

### 권고와 실패 의미

1순위는 realtyprice.kr의 `searchApt.search` 목록을 그대로 쓰고, 단지별 동 목록과
동별 호 목록도 성공 응답만 캐시하는 것이다. 목록 조회가 성공했는데 선택 이름이 없을
때만 `complexNotFound`·`dongNotFound`·`roomNotFound`라는 **자료 없음**으로 확정한다.
타임아웃·HTTP 오류·CAPTCHA·응답 스키마 변경은 `failed`로 분리하고 존재하지 않는 호로
오인하지 않는다. 목록에 호는 있지만 가격 행만 비었으면 `priceNotFound`다.

건축HUB 전유부는 realtyprice.kr 장애 시 존재 여부를 재확인할 수 있는 공식 fallback
후보다. 다만 실제 단지 표본으로 명칭·다필지 매핑률을 검증하기 전에는 자동 fallback으로
붙이지 않는다. 실거래가로 호 목록을 추정하거나, 가격 조회의 빈 응답만 보고 "존재하지
않는 호"라고 단정하는 방식은 쓰지 않는다.

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

**브라우저 관측 (2026-08-05).** `nfSiteLink.htm`에서 사이트의 공동주택 열람 링크를
따르자 `/notice/town/searchOpinion.htm`이 열렸고, 페이지 로드 중
`GET /notice/popup/captchaImg.search`가 HTTP 200으로 호출됐다. 접근성 스냅샷에는 CAPTCHA
입력 UI가 노출되지 않았고 `searchApt.search`의 가격 조회 응답이 CAPTCHA를 요구한 것까지
확인한 것은 아니다. 그러나 도전 이미지 요청을 발견한 즉시 지침대로 캡처를 중단했으며,
해결·우회나 추가 realtyprice.kr 라이브 호출은 하지 않았다. 즉 **2026-08-04의 정상 가격
조회는 유효하지만, CAPTCHA 자산은 더 이상 파라미터에만 존재하는 이론적 위험이 아니다.**

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

**자료 없는 목록 행 관측 (2026-08-04).** 목록의 `A10020277`(`테스트`)은 기본 정보
API가 성공 코드 `00`을 반환하면서 위 필수 필드를 모두 `null`로 돌려줬다. 목록 총수
22,259건 검증은 그대로 유지하되, 재시도 뒤에도 필수 상세 필드가 비어 유효한 단지를
만들 수 없는 행은 ID·목록 이름·법정동코드·사유를 적재 보고서에 남기고 제외한다. 제외가
목록의 1%를 넘으면 필드 매핑 오류 가능성이 있으므로 적재를 중단한다.

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

### 대안을 검토했고 카카오로 확정했다 (2026-08-04)

| 원천 | 비용 | 좌표계 | 입력 | 판정 |
|---|---|---|---|---|
| **카카오 로컬** | 10만건/일 무료 | **WGS84** | 주소 문자열 | **채택** |
| V-World (국토부) | 무료 | EPSG 선택 (4326 지원) | 주소 문자열 | fallback 후보 |
| juso.go.kr 좌표제공 | 무료 | EPSG:5179 (UTM-K) | **도로명주소 관리번호** | 부적합 |

**카카오를 택한 이유**
- 22,259건은 무료 한도 안이라 **비용이 0**이다. 바꿔서 얻을 금전적 이득이 없다
- 지도가 카카오맵이므로 **좌표계(WGS84)가 자동으로 일치**한다. 다른 소스는 변환이
  필요하거나 마커 위치가 미세하게 어긋날 수 있다
- 일회성 배치라 벤더 종속 위험이 낮다

`juso.go.kr`은 `admCd`·`rnMgtSn`·`buldMnnm` 등 관리번호를 요구해 주소 문자열만으로
조회할 수 없다. 선행 조회가 한 단계 더 필요해 부적합하다.

> **정정.** `iros-property-lookup` README의 "V-World는 Cloudflare에서 520으로 차단"은
> **Cloudflare Worker → api.vworld.kr 경로에만 해당**한다. 지오코딩은 Node 배치
> 스크립트로 실행하므로 그 제약을 받지 않는다. 실제로 호출해 60ms에 정상 응답을 확인했다.
> V-World를 배제할 기술적 이유는 없다.

**fallback 판단은 배치 결과를 보고 한다.** 카카오가 주소를 찾지 못하는 건(표기 불일치,
신규 단지, 지번·도로명 혼재)은 반드시 나온다. `.artifacts/geocode-report.json`의 실패
건수를 보고 결정한다 — 수십 건이면 수동 보정, 수백~수천 건이면 V-World 2차 시도를 붙인다.
**미리 만들지 않는다.**

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
