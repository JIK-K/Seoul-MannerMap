# 서울 매너 맵 (Seoul Manner Map)

서울시 공공 데이터를 기반으로 흡연구역, 공중화장실, 소방서, 응급실, 따릉이 대여소 위치를 지도 위에 시각화하는 웹 애플리케이션입니다.

[링크](https://seoul-manner-map.vercel.app/)

---

## 기술 스택

| 분류 | 기술 |
|---|---|
| 번들러 | Vite |
| 스타일링 | Tailwind CSS v4 |
| DOM/이벤트 | jQuery |
| 지도 | Kakao Maps SDK |
| 데이터 시각화 | D3.js |
| 공공 데이터 | 서울 열린데이터광장 Open API |
| 좌표 변환 | 카카오 로컬 REST API (Geocoding) |

---

## 주요 기능

- 서울 25개 자치구를 SVG 지도로 시각화, 클릭 시 해당 구 상세 지도로 전환
- D3.js 기반 휠 줌·드래그 인터랙션 (0.8x ~ 8x)
- 카카오맵 위에 공공 데이터 마커 5종 표시
- 마커 클러스터링으로 밀집 지역 가독성 확보
- 마커 클릭 시 하단 슬라이드 패널로 상세 정보 표시

---

## 데이터 소스

| 버튼 | 데이터셋 | 서비스명 | 좌표 처리 |
|---|---|---|---|
| 🚬 흡연구역 | 서울시 실외흡연 시설 현황 | `smkFclt` | 주소 → 카카오 Geocoding |
| 🚽 공중화장실 | 서울시 공중화장실 위치정보 | `mgisToiletPoi` | 좌표 직접 제공 |
| 🚒 소방서 | 서울소방서 119안전센터 현황 | `tbFirestationLoc` | 주소 → 카카오 Geocoding |
| 🏥 응급실 | 서울시 응급실 위치 정보 | `TvEmgcHospitalInfo` | 좌표 직접 제공 |
| 🚴 따릉이 | 서울시 공공자전거 따릉이 대여소 | `bikeStationMaster` | 좌표 직접 제공 |

---

## 아키텍처

```
seoul-manner-map/
├── index.html          # 진입점 HTML
├── vite.config.js      # Vite 설정 + API 프록시
├── css/
│   └── style.css       # Tailwind @import + @theme + SVG 전용 CSS
├── js/
│   ├── main.js         # 앱 초기화, D3 지도, 화면 전환
│   ├── ui.js           # 버튼 이벤트, 정보 패널
│   ├── api.js          # 서울시 공공 API 호출 및 데이터 정규화
│   ├── map.js          # 카카오맵 초기화, 마커 바인딩
│   └── state.js        # 순환 import 방지용 이벤트 브릿지
└── assets/
    └── data/
        └── Seoul_Gu.json   # 서울 25개 구 GeoJSON
```

---

## 핵심 설계 결정

### CORS 우회 — Vite Proxy

카카오 REST API와 서울시 Open API는 브라우저에서 직접 호출 시 CORS 에러가 발생합니다. Vite 개발 서버의 프록시 기능으로 우회합니다.

```js
// vite.config.js
server: {
  proxy: {
    "/seoul-api": { target: "http://openapi.seoul.go.kr:8088", changeOrigin: true },
    "/kakao-api":  { target: "https://dapi.kakao.com",          changeOrigin: true },
  }
}
```

### 순환 Import 방지 — jQuery 이벤트 브릿지

`main.js → ui.js → main.js` 순환 참조를 피하기 위해 `state.js`를 이벤트 브릿지로 사용합니다.

```
ui.js  →  state.js  →  $(window).trigger("goHome")
main.js ←  $(window).on("goHome", switchToHome)
```

### Tailwind v4 동적 클래스 문제

v4는 빌드 타임에 클래스를 정적 스캔합니다. JS에서 동적으로 조합한 클래스 문자열은 CSS가 생성되지 않아요.

- **TAG 색상 클래스** → `TAG_CONFIG` 객체에 완성된 클래스 문자열로 미리 선언
- **버튼 활성 스타일** → `$.css()` 인라인 스타일 직접 주입으로 우회
- **로딩 오버레이** → 템플릿 리터럴 대신 jQuery DOM 생성(`$("<div>").addClass(...)`)

### 대용량 데이터 페이징

서울시 API는 1회 요청에 최대 1000건 제한이 있습니다. 공중화장실(4,450건)과 따릉이(3,411건)는 첫 요청으로 `list_total_count`를 확인 후 나머지 페이지를 `Promise.all`로 병렬 수집합니다.

```js
const pageRequests = [];
for (let start = 1001; start <= total; start += 1000) {
  pageRequests.push($.ajax({ url: `.../mgisToiletPoi/${start}/${end}/` }));
}
const pages = await Promise.all(pageRequests);
```

### Geocoding

흡연구역, 소방서처럼 API 응답에 좌표가 없는 데이터는 카카오 주소검색 API로 좌표를 변환합니다. 복수 주소를 `Promise.all`로 병렬 처리해 속도를 최적화합니다.

```js
const geocoded = await Promise.all(
  rows.map(async (r) => {
    const coords = await geocodeAddress(query);
    if (!coords) return null;
    return { ...r, lat: coords.lat, lng: coords.lng };
  })
);
```

### D3 SVG 지도

GeoJSON 좌표를 SVG 픽셀 좌표로 변환하는 데 D3의 `geoMercator` projection을 사용합니다. `viewBox` 고정값 방식으로 화면 크기와 무관하게 항상 동일한 위치에 렌더링됩니다.

```js
d3.select("#seoul-gu-svg")
  .attr("viewBox", "0 0 860 780")
  .attr("preserveAspectRatio", "xMidYMid meet");
```

줌 레벨에 따라 구 이름 폰트 크기를 반비례로 조정해 어떤 배율에서도 텍스트를 읽을 수 있습니다.

```js
g.selectAll(".gu-text").style("font-size", `${Math.max(7, 10 / k)}px`);
```

---

## 환경변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다.

```env
VITE_KAKAO_MAP_API_KEY=     # 카카오 JavaScript 키 (지도 SDK)
VITE_KAKAO_REST_API_KEY=    # 카카오 REST API 키 (Geocoding)
VITE_SEOUL_API_KEY=         # 서울 열린데이터광장 인증키
```

| 키 | 발급처 |
|---|---|
| 카카오 JavaScript 키 | [카카오 개발자 콘솔](https://developers.kakao.com) → 앱 → 플랫폼 → Web 등록 |
| 카카오 REST API 키 | 동일 콘솔, 앱 키 탭 |
| 서울시 인증키 | [서울 열린데이터광장](https://data.seoul.go.kr) → Open API 인증키 신청 |

---

## 설치 및 실행

```bash
# 패키지 설치
yarn install

# 개발 서버 실행
yarn dev

# 프로덕션 빌드
yarn build
```

---

## 데이터 흐름

```
구 선택 (D3 클릭)
  └─ switchToDetail()
       ├─ 카카오맵 초기화
       └─ fetchSmoking() → bindMarkers() → 마커 표시

필터 버튼 클릭
  └─ handleFetch(fetchFn)        공통 처리 함수
       ├─ api.js fetch 함수 호출  서울시 API → 정규화된 배열
       └─ bindMarkers(data)      카카오맵 마커 갱신

마커 클릭
  └─ $(window).trigger("openDetail", [item])
       └─ ui.js openDetail 핸들러
            └─ DOM 주입 → 하단 패널 슬라이드업
```
