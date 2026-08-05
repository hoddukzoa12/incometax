# 카카오맵 JavaScript SDK 레퍼런스

P2(지도 + 사이드바) 구현에 필요한 것만 추린 실무 레퍼런스.
[공식 샘플 77개](https://apis.map.kakao.com/web/sample/)를 전수 조사해 코드를 확인한 결과다.

규칙은 [AGENTS.md](../AGENTS.md), 외부 API 계약은 [external-apis.md](./external-apis.md).

---

## 0. 결론 먼저

| 과제 | 해법 | 근거 샘플 |
|---|---|---|
| 단지명 라벨 | `CustomOverlay` + HTML | `customOverlay1/2` |
| **라벨 겹침** | **낮은 줌에서 `Marker` + `MarkerClusterer`로 전환** | `chickenClusterer` |
| bbox 갱신 | `bounds_changed` + `map.getBounds()` + 디바운스 | `addMapBoundsChangedEvent`, `mapInfo` |
| 단지 이름 검색 | `services.Places.keywordSearch` + 페이지네이션 | `keywordList` |
| 사이드바 열기 | 라벨 `onclick` (오버레이는 DOM이므로 그냥 핸들러) | `removableCustomOverlay` |

**쓰지 않는 것**: 로드뷰(9), Drawing Library(4), 정적지도(3), 교통·지형 오버레이,
런타임 카테고리 검색. 이유는 §5.

---

## 1. 로딩과 키

```html
<script src="//dapi.kakao.com/v2/maps/sdk.js?appkey=KEY&libraries=services,clusterer"></script>
```

| 항목 | 값 |
|---|---|
| 키 종류 | **JavaScript 키** (REST 키 아님 — 지오코딩 배치는 REST 키) |
| 도메인 등록 | 필수. 배포 도메인 + `localhost` |
| 필요한 라이브러리 | `services`(장소검색), `clusterer`(클러스터) |
| 무료 한도 | SDK 300,000건/일 · 전체 3,000,000건/월 |

`libraries`에 없는 기능은 로드되지 않는다. `drawing`은 쓰지 않으므로 넣지 않는다.

---

## 2. 지도 기본

### 생성

```js
const map = new kakao.maps.Map(document.getElementById('map'), {
  center: new kakao.maps.LatLng(37.4996, 127.0659),
  level: 4,        // 숫자가 작을수록 확대. 1이 최대 확대
})
```

> **레벨은 역방향이다.** 일반적인 zoom과 반대로 **작을수록 확대**된다.
> 최소 표시 레벨 정책을 짤 때 부등호 방향을 틀리기 쉽다.

### 상태 읽기 — `mapInfo`

```js
map.getCenter()      // LatLng
map.getLevel()       // number
map.getBounds()      // LatLngBounds
  .getSouthWest()    // LatLng  → bbox의 south, west
  .getNorthEast()    // LatLng  → bbox의 north, east
```

우리 `/api/complexes`가 `south/north/west/east`를 받으므로 그대로 대응된다.

### 제어

| 기능 | API | 샘플 |
|---|---|---|
| 중심 이동 | `map.panTo(latlng)` / `setCenter` | `moveMap` |
| 레벨 변경 | `map.setLevel(n)` | `changeLevel` |
| 범위 맞춤 | `map.setBounds(LatLngBounds)` | `setBounds` |
| 컨테이너 크기 변경 후 | `map.relayout()` | `mapRelayout` |
| 줌 컨트롤 | `new kakao.maps.ZoomControl()` + `map.addControl(c, ControlPosition.RIGHT)` | `addMapControl` |

> **`relayout()`을 잊지 말 것.** 사이드바가 열리고 닫히며 지도 컨테이너 폭이 바뀌면
> 호출해야 한다. 안 하면 타일이 어긋난 채로 남는다.

---

## 3. 이벤트

```js
kakao.maps.event.addListener(map, 'bounds_changed', handler)
kakao.maps.event.removeListener(map, 'bounds_changed', handler)   // 정리 필수
```

| 이벤트 | 발생 시점 | 우리 쓰임 |
|---|---|---|
| **`bounds_changed`** | 영역이 바뀔 때마다 | **bbox 재조회 트리거** |
| `zoom_changed` | 레벨 변경 | 라벨/클러스터 모드 전환 |
| `center_changed` | 중심 이동 | (불필요 — `bounds_changed`로 충분) |
| `dragend` | 드래그 종료 | 이동 중이 아닌 종료 시점만 필요하면 |
| `tilesloaded` | 타일 로딩 완료 | 초기 렌더 완료 판정 |
| `idle` | 이동·확대가 멎었을 때 | **`bounds_changed` 대신 이걸 쓰는 게 낫다** |

> **`bounds_changed`는 드래그 중 연속 발생한다.** 그대로 API를 붙이면 요청이 폭주한다.
> `idle`을 쓰거나 `bounds_changed`에 디바운스(200~300ms)를 건다.
>
> 기존 서비스(WhereIsMyHome)가 `idle`에 장소 검색을 직결해 쿼터를 태운 사례가 있다.
> 우리는 `idle` → 디바운스 → **D1 조회**(무료)만 한다. 카카오 API를 붙이지 않는다.

React에서는 `useEffect` 정리 함수에서 반드시 `removeListener`한다.

---

## 4. 오버레이 — 단지명 라벨의 핵심

### 4.1 CustomOverlay

`content`에 **HTML 문자열 또는 DOM 엘리먼트**를 넣는다. 마커 이미지가 아니라 그냥 DOM이다.

```js
const overlay = new kakao.maps.CustomOverlay({
  map,
  position: new kakao.maps.LatLng(lat, lng),
  content: element,     // HTMLElement 또는 HTML string
  yAnchor: 1,           // 1이면 position이 콘텐츠의 아래쪽 끝
  zIndex: 2,
  clickable: true,      // 내부 클릭 이벤트를 지도에 전달하지 않음
})
overlay.setMap(null)    // 제거
```

**우리 라벨**

```
┌──────────────┐
│  은마아파트   │  ← 단지명만
└──────▼───────┘  ← yAnchor: 1 로 꼭짓점이 좌표를 가리킴
```

가격은 띄우지 않는다. 실거래가는 `법정동코드 × 거래년월` 단위로만 조회되어
지도 이동마다 대량 호출이 필요하다. 사이드바에서 단지 하나를 열 때만 조회한다
(roadmap P2 라벨 설계 참조).

DOM이므로 `element.onclick`으로 사이드바를 연다. 별도 이벤트 등록이 필요 없다.

React에서는 `createRoot(el).render(<ComplexLabel .../>)` 후 그 `el`을 `content`로 넘긴다.

> **지도 이벤트 전파 차단**: 오버레이 내부에서 마우스를 눌렀을 때 지도가 드래그되지
> 않게 하려면 `kakao.maps.event.preventMap`을 `mousedown`/`touchstart`에 건다.

### 4.2 겹침 해결 — 하이브리드

**`MarkerClusterer`는 `Marker`만 받는다. `CustomOverlay`에는 적용되지 않는다.**
전국 22,259개를 라벨로 뿌릴 수 없으므로 레벨에 따라 전환한다.

```
레벨 1~N (확대)   → CustomOverlay 단지명 라벨
레벨 N+1~ (축소)  → Marker + MarkerClusterer ("N개 단지")
```

```js
const clusterer = new kakao.maps.MarkerClusterer({
  map,
  averageCenter: true,       // 포함 마커들의 평균 위치를 클러스터 위치로
  minLevel: 10,              // 이 레벨 이상(축소)에서만 클러스터
  calculator: [10, 30, 50],  // 구간 경계
  texts: (count) => `${count}개 단지`,   // 배열도 가능
  styles: [ {...}, {...}, {...}, {...} ], // calculator 구간 수 + 1 개
})
clusterer.addMarkers(markers)
```

`texts`는 함수 또는 배열이다. `styles`는 `calculator` 구간마다 하나씩,
즉 **구간 수 + 1개**를 준다. 클러스터 클릭 이벤트는 `addClustererClickEvent` 참조.

### 4.3 좌표가 없는 단지

카카오 장소 DB에 없는 단지가 5.2%(1,148건) 남는다 — 신축·청년주택·소규모.

| 상태 | 표시 |
|---|---|
| 좌표 있음 (`matched`) | 지도에 단지명 라벨 |
| 좌표 없음 (`notFound` / `rejected`) | 지도에 없음. **검색으로 도달** |

검색은 카카오가 아니라 **우리 `complex` 테이블**을 조회한다. 카카오를 검색하면
바로 이 단지들이 영영 안 잡힌다. 좌표가 없어도 세금 계산은 정상 동작한다.

### 4.4 안 쓰는 오버레이

`InfoWindow`는 스타일 제약이 커서 쓰지 않는다. 사이드바가 그 역할을 한다.
`Polygon`·`Circle`·`Polyline`은 이 프로젝트에 해당 없음.

---

## 5. 장소 검색 — 단지 이름 검색 전용

```js
const ps = new kakao.maps.services.Places()
ps.keywordSearch(keyword, (data, status, pagination) => {
  if (status === kakao.maps.services.Status.OK) {
    // data: 최대 15건
    // pagination.last, pagination.current, pagination.gotoPage(n)
  } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
  } else if (status === kakao.maps.services.Status.ERROR) {
  }
})
```

`Status`는 `OK` / `ZERO_RESULT` / `ERROR` 세 가지다. 반드시 세 갈래를 모두 처리한다.

### 쓰는 범위 — 이름 검색만

> ⚠️ **영역을 빠짐없이 나열하는 용도로 쓸 수 없다.**
> 실측: 강남 bbox `아파트` 검색 → `total_count` **2,254**, `pageable_count` **45**.
> 존재하는 2,254개 중 45개만 꺼낼 수 있고, 어느 칸이 완전한지 알 방법이 없다.
> **조용한 누락**이 발생하므로 지도 마커는 반드시 D1 bbox 조회를 쓴다.

| 용도 | 판정 |
|---|---|
| 사용자가 "은마"를 쳐서 찾아가기 | ✅ 45건 상한이 문제되지 않음 |
| 이 영역의 단지 전부 나열 | ❌ D1 |

### 그 외 services

| API | 쓰는가 |
|---|---|
| `Geocoder.addressSearch` | 런타임 ❌ / **배치 REST로만** (단지 마스터 구축) |
| `Geocoder.coord2Address` | ❌ |
| `Places.categorySearch` | ❌ 주변 편의시설은 범위 밖 (AGENTS.md §2) |

---

## 6. 전체 샘플 목록 (77개)

전수 조사 결과. **✅ 채택 / ⬜ 미사용**

### 지도 (24)

| 샘플 | 내용 | |
|---|---|---|
| `basicMap` | 지도 생성 | ✅ |
| `moveMap` | 지도 이동 | ✅ |
| `changeLevel` | 레벨 변경 | ✅ |
| `mapInfo` | 중심·레벨·**bounds 얻기** | ✅ |
| `addMapControl` | 줌·타입 컨트롤 | ✅ |
| `setBounds` | 범위 재설정 | ✅ |
| `mapRelayout` | **컨테이너 크기 변경 대응** | ✅ |
| `addMapBoundsChangedEvent` | **영역 변경 이벤트** | ✅ |
| `addMapZoomChangedEvent` | 확대·축소 이벤트 | ✅ |
| `addTilesloadedEvent` | 타일 로드 완료 | ✅ |
| `addMapClickEvent` | 클릭 이벤트 | ⬜ |
| `addMapClickEventWithMarker` | 클릭 위치에 마커 | ⬜ |
| `addMapDragendEvent` | 드래그 종료 | ⬜ |
| `addMapCenterChangedEvent` | 중심 변경 | ⬜ |
| `addMapCustomControl` | 사용자 컨트롤 | ⬜ |
| `disableMapDragMove` | 이동 막기 | ⬜ |
| `enableDisableZoomInOut` | 확대 막기 | ⬜ |
| `addTrafficOverlay` | 교통정보 | ⬜ |
| `addRoadviewOverlay` | 로드뷰 도로 | ⬜ |
| `addTerrainOverlay` | 지형도 | ⬜ |
| `changeOverlay1` / `changeOverlay2` | 지도 타입 전환 | ⬜ |
| `customTileset` / `getTile` | 커스텀 타일 | ⬜ |

### 오버레이 (28)

| 샘플 | 내용 | |
|---|---|---|
| `customOverlay1` | **커스텀 오버레이 기본** | ✅ |
| `customOverlay2` | **HTML 콘텐츠 오버레이** | ✅ |
| `removableCustomOverlay` | 닫기 가능한 오버레이 | ✅ |
| `markerWithCustomOverlay` | 마커 + 오버레이 조합 | ✅ |
| `multipleMarkerControl` | **여러 마커 제어(표시/숨김)** | ✅ |
| `multipleMarkerEvent` / `multipleMarkerEvent2` | 여러 마커 이벤트 | ✅ |
| `basicMarker` | 마커 생성 | ✅ |
| `basicMarkerImage` | 마커 이미지 교체 | ✅ |
| `markerTracker` | 영역 밖 마커 추적 | ⬜ 검토 |
| `addMarkerClickEvent` / `addMarkerMouseEvent` | 마커 이벤트 | ⬜ |
| `basicInfoWindow` / `markerWithInfoWindow` | 인포윈도우 | ⬜ 사이드바가 대체 |
| `draggableMarker` / `addDraggableMarkerDragEvent` / `dragCustomOverlay` | 드래그 | ⬜ |
| `geolocationMarker` | 현위치 | ⬜ 검토 |
| `multipleMarkerImage` / `categoryMarker` | 다중 이미지 마커 | ⬜ |
| `drawShape` / `donut` | 도형 | ⬜ |
| `calculatePolylineDistance` / `calculatePolygonArea` / `calculateCircleRadius` | 계측 | ⬜ |
| `addPolygonMouseEvent1` / `addPolygonMouseEvent2` | 다각형 이벤트 | ⬜ |

### 라이브러리 (13)

| 샘플 | 내용 | |
|---|---|---|
| `keywordList` | **키워드 검색 + 목록 + 페이지네이션** | ✅ |
| `keywordBasic` | 키워드 검색 기본 | ✅ |
| `basicClusterer` | **마커 클러스터러** | ✅ |
| `chickenClusterer` | **클러스터에 텍스트 표시** | ✅ |
| `addClustererClickEvent` | 클러스터 클릭 | ✅ |
| `addr2coord` | 주소 → 좌표 | ⬜ 배치는 REST |
| `coord2addr` | 좌표 → 주소 | ⬜ |
| `categoryBasic` / `categoryFromBounds` | 카테고리 검색 | ⬜ 범위 밖 |
| `transCoord` | WTM → WGS84 | ⬜ |
| `basicDrawingLibrary` / `drawingGetData` / `drawingToolbox` / `drawingUndo` | Drawing | ⬜ |

### 로드뷰 (9) · 정적지도 (3) — 전부 미사용

`basicRoadview` `basicRoadview2` `moveRoadview` `roadviewOverlay1` `roadviewOverlay2`
`roadviewCustomOverlay` `roadviewImageOverlay` `roadviewWithMapButton` `roadviewToggle`
`staticMap` `staticMapWithMarker` `staticMapWithMarkerText`

로드뷰는 세금 계산과 무관하고 쿼터를 소모한다. 정적지도는 1,000건/일로 한도가 낮다.

---

## 7. 구현 시 주의

1. **레벨은 작을수록 확대.** 부등호를 반대로 쓰기 쉽다
2. **`bounds_changed`는 연속 발생.** `idle` 또는 디바운스 필수
3. **`removeListener` 정리.** React 언마운트 시 누수
4. **사이드바 토글 후 `map.relayout()`**
5. **`MarkerClusterer`는 `Marker` 전용.** `CustomOverlay`에 안 걸린다
6. **`styles`는 `calculator` 구간 수 + 1개**
7. **JavaScript 키는 클라이언트 노출.** 도메인 등록이 유일한 방어 (AGENTS.md §2)
8. **`Status` 세 갈래 모두 처리**: `OK` / `ZERO_RESULT` / `ERROR`
