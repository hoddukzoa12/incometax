# 보유세 계산기

지도에서 아파트를 고르면 공시가격으로 재산세와 종합부동산세를 계산합니다.
2026 세제개편안(정부안)을 반영해 앞으로 5년치 보유세가 어떻게 움직이는지 함께 보여줍니다.

**[tax.rich-group.kr](https://tax.rich-group.kr)** | 운영: 세무법인 리치

---

## 주요 기능

- 카카오맵 기반 단지 검색 — 22,000+ 아파트 단지
- 동·호를 골라 공시가격 자동 조회
- 재산세 · 종합부동산세 · 농어촌특별세 · 세부담상한 계산
- 2025~2030년 연도별 추이 막대 그래프
- 1세대1주택 세액공제 (연령·보유·거주)
- 과세표준상한제 (5%) 반영
- 모바일 대응

## 세법 근거

| 항목 | 근거 |
|---|---|
| 재산세 | 지방세법 §111, 시행령 §109 |
| 종합부동산세 | 종부세법 §8~§10 |
| 2026 세제개편안 | 기획재정부 2026 세법개정안 (정부안) |
| 공정시장가액비율 | 지방세법 시행령 §109①2 (60%), 종부세법 시행령 (2026: 60%, 2027~: 70%) |
| 세액공제 | 종부세법 §9⑤~⑨ — 2026 연령+보유, 2027 연령+MAX(보유,거주), 2028~ 연령+거주 |
| 세부담상한 | 종부세법 §10 — 2026 150%, 2027~ 200% |

## 기술 스택

- **프론트엔드**: React + TypeScript + Vite
- **백엔드**: Cloudflare Workers
- **데이터베이스**: Cloudflare D1 (SQLite)
- **캐시**: Cloudflare KV
- **지도**: Kakao Maps SDK
- **공시가격**: 부동산공시가격 알리미 (realtyprice.kr)
- **실거래가**: 국토교통부 실거래가 API (data.go.kr)

## 개발

```bash
npm install
npm run dev          # Vite + Wrangler dev server
npm test             # Vitest (380+ tests)
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run deploy       # Cloudflare Workers 배포
```

### 환경변수

`.dev.vars`에 설정:

```
DATA_GO_KR_SERVICE_KEY=...   # 공공데이터포털 서비스키
KAKAO_REST_API_KEY=...       # 카카오 REST API 키
YOUTUBE_VIDEO_ID=...         # 유튜브 영상 ID (선택)
```

프론트엔드용 (`.env`):

```
VITE_KAKAO_MAP_JAVASCRIPT_KEY=...   # 카카오맵 JavaScript 키
```

## 라이선스

Private — 세무법인 리치
