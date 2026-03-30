import $ from "jquery";
import * as d3 from "d3";
import { initMap, bindMarkers } from "./map.js";
import { initUI } from "./ui.js";
import { fetchSmoking } from "./api.js";

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_API_KEY;

const guCenters = {
  종로구: { lat: 37.573, lng: 126.9794 },
  중구: { lat: 37.5641, lng: 126.9979 },
  용산구: { lat: 37.5326, lng: 126.9904 },
  성동구: { lat: 37.5633, lng: 127.0371 },
  광진구: { lat: 37.5385, lng: 127.0824 },
  동대문구: { lat: 37.5744, lng: 127.04 },
  중랑구: { lat: 37.6065, lng: 127.0927 },
  성북구: { lat: 37.5891, lng: 127.0182 },
  강북구: { lat: 37.6396, lng: 127.0255 },
  도봉구: { lat: 37.6688, lng: 127.0471 },
  노원구: { lat: 37.6542, lng: 127.0568 },
  은평구: { lat: 37.6027, lng: 126.9291 },
  서대문구: { lat: 37.5791, lng: 126.9368 },
  마포구: { lat: 37.5662, lng: 126.9016 },
  양천구: { lat: 37.5169, lng: 126.8664 },
  강서구: { lat: 37.5509, lng: 126.8495 },
  구로구: { lat: 37.4954, lng: 126.8875 },
  금천구: { lat: 37.4568, lng: 126.8952 },
  영등포구: { lat: 37.5264, lng: 126.8962 },
  동작구: { lat: 37.5124, lng: 126.9395 },
  관악구: { lat: 37.4784, lng: 126.9516 },
  서초구: { lat: 37.4837, lng: 127.0324 },
  강남구: { lat: 37.4979, lng: 127.0276 },
  송파구: { lat: 37.5145, lng: 127.1063 },
  강동구: { lat: 37.5301, lng: 127.1238 },
};

function loadKakaoSDK() {
  const dfd = $.Deferred(); //JQuery의 Promise 구현체로 await로 사용가능
  if (typeof kakao !== "undefined") return dfd.resolve(true).promise();
  if (!KAKAO_KEY) return dfd.resolve(false).promise();
  const script = document.createElement("script");
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=clusterer&autoload=false`;
  script.async = true;
  script.onload = () => window.kakao.maps.load(() => dfd.resolve(true));
  script.onerror = () => dfd.resolve(false);
  document.head.appendChild(script);
  return dfd.promise();
}

// ── 지도 위 로딩 오버레이 ────────────────────────────────────────
function showMapLoading(visible, message = "LOADING...") {
  $("#map-loading").remove();
  if (!visible) return;

  // jQuery로 DOM 생성 — Tailwind 클래스 적용 가능
  const $overlay = $("<div>", { id: "map-loading" }).addClass(
    "absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-mainColor/75 backdrop-blur",
  );

  const $spinner = $("<div>").addClass(
    "w-7 h-7 rounded-full border-2 border-accent/20 border-t-accent animate-spin",
  );

  const $msg = $("<p>")
    .addClass("font-mono text-[0.7rem] tracking-widest text-accent")
    .text(message);

  $overlay.append($spinner, $msg);
  $("#kakao-map-container").append($overlay);
}

// ── 구 선택 화면 복귀 ────────────────────────────────────────────
function switchToHome() {
  showMapLoading(false);
  $("#info-panel").css("transform", "translateY(100%)");
  $("#kakao-map-container").css({ opacity: 0, "pointer-events": "none" });
  $("#gu-map-container").css({ opacity: 1, "pointer-events": "auto" });
  $(window).trigger("resetBtns");
  $("#marker-count-wrap").addClass("hidden");
}

function updateMarkerCount(count) {
  $("#marker-count").text(count);
  if (count > 0) $("#marker-count-wrap").removeClass("hidden");
  else $("#marker-count-wrap").addClass("hidden");
}

// ── 구 클릭 → 상세 화면 전환 ────────────────────────────────────
async function switchToDetail(name, coords) {
  $("#selected-gu-name").text(`${name} 안심·매너`);
  $("#gu-map-container").css({ opacity: 0, "pointer-events": "none" });
  $("#kakao-map-container").css({ opacity: 1, "pointer-events": "auto" });

  initMap("map", coords);

  showMapLoading(true, "LOCATING SMOKING AREAS...");
  try {
    const data = await fetchSmoking(name);
    bindMarkers(data);
    updateMarkerCount(data.length);
    $(window).trigger("setActiveBtn", ["smoke"]);
  } finally {
    showMapLoading(false);
  }
}

// ── D3 서울 구 지도 (휠 줌 지원) ────────────────────────────────
function drawGuMap(geojson) {
  const VW = 860,
    VH = 780;

  const svg = d3
    .select("#seoul-gu-svg")
    .attr("viewBox", `0 0 ${VW} ${VH}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("class", "map-root");

  const projection = d3
    .geoMercator()
    .center([126.978, 37.565])
    .scale(120000)
    .translate([VW / 2, VH / 2]);

  const path = d3.geoPath().projection(projection);

  const guGroups = g.selectAll("g").data(geojson.features).enter().append("g");

  guGroups.append("path").attr("d", path).attr("class", "gu-path");

  guGroups
    .append("text")
    .attr("class", "gu-text")
    .attr("transform", (d) => `translate(${path.centroid(d)})`)
    .text((d) => d.properties.SIG_KOR_NM);

  guGroups.on("click", (event, d) => {
    if (event.defaultPrevented) return;
    const guName = d.properties.SIG_KOR_NM;
    const center = guCenters[guName];
    if (center) switchToDetail(guName, center);
  });

  const zoom = d3
    .zoom()
    .scaleExtent([0.8, 8])
    .translateExtent([
      [-VW * 0.5, -VH * 0.5],
      [VW * 1.5, VH * 1.5],
    ])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
      const k = event.transform.k;
      g.selectAll(".gu-text").style("font-size", `${Math.max(7, 10 / k)}px`);
      if (k !== 1) $("#zoom-hint").fadeOut(300);
      else $("#zoom-hint").fadeIn(300);
    });

  svg.call(zoom);

  svg.on("dblclick.zoom", () => {
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
  });
  svg.on("mousedown.cursor", () => {
    d3.select("#seoul-gu-svg").style("cursor", "grabbing");
  });
  svg.on("mouseup.cursor", () => {
    d3.select("#seoul-gu-svg").style("cursor", "grab");
  });

  $("#loading-spinner").addClass("hidden");
}

// ── 앱 초기화 ────────────────────────────────────────────────────
async function init() {
  initUI();
  $(window).on("goHome", switchToHome);
  $(window).on("updateCount", (_e, count) => updateMarkerCount(count));
  $(window).on("showMapLoading", (_e, visible, msg) =>
    showMapLoading(visible, msg),
  );

  try {
    const geojson = await $.ajax({
      url: "/assets/data/Seoul_Gu.json",
      dataType: "json",
    });
    drawGuMap(geojson);
  } catch (err) {
    console.error("지도 데이터 로드 실패:", err);
    $("#loading-spinner").html(
      `<p class="font-mono text-xs text-fire">ERROR: 지도 데이터 로드 실패</p>`,
    );
  }

  await loadKakaoSDK();
}

$(function () {
  init();
});
