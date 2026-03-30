import $ from "jquery";

const SEOUL_API_KEY = import.meta.env.VITE_SEOUL_API_KEY;
const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;

/**
 * 카카오 주소검색 (주소 -> 좌표 변환)
 * @param {string} address
 * @returns
 */
async function geocodeAddress(address) {
  try {
    const data = await $.ajax({
      url: "/kakao-api/v2/local/search/address.json",
      method: "GET",
      headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
      data: { query: address, size: 1 },
    });
    const doc = data?.documents?.[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch {
    return null;
  }
}

/**
 * 흡연구역 API는 좌표 정보가 없으므로, 설치 위치(INSTL_PSTN)를 카카오 주소 검색으로 geocoding
 * 구 이름(CGG_NM)으로 해당 구의 데이터만 필터링
 * 설치 위치에 괄호로 보조 설명이 있는 경우, 괄호 안 내용을 주소 검색에 활용 (예: "역삼역 4번 출구(강남구청 방향)")
 * @param {string} guName
 * @returns
 */
export async function fetchSmoking(guName) {
  try {
    const data = await $.ajax({
      url: `/seoul-api/${SEOUL_API_KEY}/json/smkFclt/1/1000/`,
      method: "GET",
      dataType: "json",
    });

    const rows = (data?.smkFclt?.row ?? []).filter(
      (r) => r.CGG_NM === guName && r.INSTL_PSTN,
    );
    if (rows.length === 0) return [];

    const geocoded = await Promise.all(
      rows.map(async (r) => {
        const parenMatch = r.INSTL_PSTN.match(/\(([^)]+)\)/);
        const query = parenMatch
          ? `서울특별시 ${guName} ${parenMatch[1]}`
          : `서울특별시 ${guName} ${r.INSTL_PSTN}`;

        const coords = await geocodeAddress(query);
        if (!coords) return null;

        return {
          id: `smoke-${r.NO}`,
          name: r.INSTL_PSTN,
          address: `서울특별시 ${r.CGG_NM} ${r.INSTL_PSTN}`,
          sub: `${r.FCLT_SHP || ""} · ${r.IMPV || 1}개소`,
          lat: coords.lat,
          lng: coords.lng,
          type: "SMOKE",
        };
      }),
    );
    return geocoded.filter(Boolean);
  } catch (err) {
    console.error("❌ 흡연구역 API 오류:", err);
    return [];
  }
}

/**
 * 공중화장실 API 호출
 * @param {string} guName
 * @returns
 */
export async function fetchToilet(guName) {
  try {
    // 1차: 1~1000 호출로 total_count 파악
    const first = await $.ajax({
      url: `/seoul-api/${SEOUL_API_KEY}/json/mgisToiletPoi/1/1000/`,
      method: "GET",
      dataType: "json",
    });

    const total = parseInt(first?.mgisToiletPoi?.list_total_count ?? 0);
    let allRows = first?.mgisToiletPoi?.row ?? [];

    // 1000건 초과 시 나머지 페이지 병렬 수집
    if (total > 1000) {
      const pageRequests = [];
      for (let start = 1001; start <= total; start += 1000) {
        const end = Math.min(start + 999, total);
        pageRequests.push(
          $.ajax({
            url: `/seoul-api/${SEOUL_API_KEY}/json/mgisToiletPoi/${start}/${end}/`,
            method: "GET",
            dataType: "json",
          }).then((d) => d?.mgisToiletPoi?.row ?? []),
        );
      }
      const pages = await Promise.all(pageRequests);
      pages.forEach((rows) => {
        allRows = allRows.concat(rows);
      });
    }

    return allRows
      .filter((r) => r.GU_NAME === guName && r.COORD_X && r.COORD_Y)
      .map((r) => ({
        id: `toilet-${r.OBJECTID}`,
        name: r.CONTS_NAME || "공중화장실",
        address: r.ADDR_NEW || r.ADDR_OLD || "",
        sub: [
          r.VALUE_02?.replace(/\|/g, " ").trim(), // 개방시간
          r.TEL_NO ? `☎ ${r.TEL_NO}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        lat: parseFloat(r.COORD_Y), // Y = 위도
        lng: parseFloat(r.COORD_X), // X = 경도
        type: "TOILET",
      }))
      .filter((r) => !isNaN(r.lat) && !isNaN(r.lng));
  } catch (err) {
    console.error("❌ 공중화장실 API 오류:", err);
    return [];
  }
}

/**
 * 소방서 API 호출
 * @param {string} guName
 * @returns
 */
export async function fetchFireStation(guName) {
  try {
    const data = await $.ajax({
      url: `/seoul-api/${SEOUL_API_KEY}/json/tbFirestationLoc/1/1000/`,
      method: "GET",
      dataType: "json",
    });

    const rows = (data?.tbFirestationLoc?.row ?? []).filter((r) => {
      // 관할구역(FIRESTATION_GCC) 또는 위치(FIRESTATION_LOC)에 구 이름 포함
      return (
        (r.FIRESTATION_GCC && r.FIRESTATION_GCC.includes(guName)) ||
        (r.FIRESTATION_LOC && r.FIRESTATION_LOC.includes(guName))
      );
    });

    if (rows.length === 0) return [];

    const geocoded = await Promise.all(
      rows.map(async (r) => {
        const address = r.FIRESTATION_LOC || "";
        if (!address) return null;

        const coords = await geocodeAddress(address);
        if (!coords) return null;

        return {
          id: `fire-${r.FIRESTATION_NM}`,
          name: r.FIRESTATION_NM || "안전센터",
          address: r.FIRESTATION_LOC || "",
          sub: [
            r.FIRESTATION_ST ? `${r.FIRESTATION_ST}` : "",
            r.TEL_NO ? `☎ ${r.TEL_NO}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          lat: coords.lat,
          lng: coords.lng,
          type: "FIRE",
        };
      }),
    );

    return geocoded.filter(Boolean);
  } catch (err) {
    console.error("❌ 소방서 API 오류:", err);
    return [];
  }
}

export async function fetchEmergencyRoom(guName) {
  try{
    const data = await $.ajax({
      url: `/seoul-api/${SEOUL_API_KEY}/json/TvEmgcHospitalInfo/1/1000/`,
      method: "GET",
      dataType: "json",
    });
    
    const rows = data.TvEmgcHospitalInfo.row ?? [];

    return rows.filter((r) => r.DUTYADDR && r.DUTYADDR.includes(guName))
    .map((r) => ({
      id: `emergency-${r.HPID}`,
      name: r.DUTYNAME || "응급실",
      address: r.DUTYADDR || "",
      sub: [
        r.DUTYEMCLSNAME,
        r.DUTYTEL3 ? `☎ ${r.DUTYTEL3}` : r.DUTYTEL1 ? `☎ ${r.DUTYTEL1}` : "",
      ].filter(Boolean).join(" · "),
      lat: parseFloat(r.WGS84LAT),
      lng: parseFloat(r.WGS84LON),
      type: "EMERGENCY",
    }))
    .filter((r) => !isNaN(r.lat) && !isNaN(r.lng));
    
  } catch (err) {
    console.error("❌ 응급실 API 오류:", err);
    return [];
  }
}

export async function fetchBikeStation(guName) {
  try {
    // 전체 3411건 → 1차 호출로 total 파악 후 페이징
    const first = await $.ajax({
      url: `/seoul-api/${SEOUL_API_KEY}/json/bikeStationMaster/1/1000/`,
      method: "GET",
      dataType: "json",
    });

    const total = parseInt(first?.bikeStationMaster?.list_total_count ?? 0);
    let allRows = first?.bikeStationMaster?.row ?? [];

    if (total > 1000) {
      const pageRequests = [];
      for (let start = 1001; start <= total; start += 1000) {
        const end = Math.min(start + 999, total);
        pageRequests.push(
          $.ajax({
            url: `/seoul-api/${SEOUL_API_KEY}/json/bikeStationMaster/${start}/${end}/`,
            method: "GET",
            dataType: "json",
          }).then((d) => d?.bikeStationMaster?.row ?? []),
        );
      }
      const pages = await Promise.all(pageRequests);
      pages.forEach((rows) => { allRows = allRows.concat(rows); });
    }

    return allRows
      .filter((r) => r.ADDR1 && r.ADDR1.includes(guName))
      .map((r) => ({
        id:      `bike-${r.RNTLS_ID}`,
        name:    r.RNTLS_ID,
        address: r.ADDR1,
        sub:     r.ADDR2 || "",
        lat:     parseFloat(r.LAT),
        lng:     parseFloat(r.LOT),
        type:    "BIKE",
      }))
      .filter((r) => !isNaN(r.lat) && !isNaN(r.lng) && r.lat !== 0 && r.lng !== 0);

  } catch (err) {
    console.error("❌ 자전거 대여소 API 오류:", err);
    return [];
  }
}