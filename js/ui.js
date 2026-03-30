// js/ui.js
import $ from "jquery";
import { fetchSmoking, fetchToilet, fetchFireStation, fetchEmergencyRoom, fetchBikeStation } from "./api.js";
import { bindMarkers } from "./map.js";
import { goHome } from "./state.js";

const TAG_CONFIG = {
  SMOKE: {
    label: "SMOKING AREA",
    cls: "bg-smoke/15  text-smoke  border border-smoke/30",
  },
  TOILET: {
    label: "PUBLIC TOILET",
    cls: "bg-toilet/15 text-toilet border border-toilet/30",
  },
  FIRE: {
    label: "FIRE STATION",
    cls: "bg-fire/15   text-fire   border border-fire/30",
  },
  EMERGENCY:{
    label: "EMERGENCY ROOM",
    cls: "bg-emergency/15   text-emergency   border border-emergency/30",
  },
  BIKE:{
    label: "BIKE STATION",
    cls: "bg-bike/15   text-bike   border border-bike/30",
  }
};

// 버튼별 활성 스타일 — v4에서 CSS 변수로 style 직접 주입
const BTN_ACTIVE_STYLE = {
  smoke: { borderColor: "#f59e0b", background: "rgba(245,158,11,0.10)" },
  toilet: { borderColor: "#06b6d4", background: "rgba(6,182,212,0.10)" },
  fire: { borderColor: "#ef4444", background: "rgba(239,68,68,0.10)" },
  emergency: { borderColor: "#8b5cf6", background: "rgba(139,92,246,0.10)" },
  bike: { borderColor: "#22c55e", background: "rgba(34,197,94,0.10)" },
};

export function initUI() {
  const $panel = $("#info-panel");
  const $btnSmoking = $("#btn-smoking");
  const $btnToilet = $("#btn-toilet");
  const $btnFire = $("#btn-fire");
  const $btnEmergency = $("#btn-emergency");
  const $btnBike = $("#btn-bike");
  const $allBtns = $btnSmoking.add($btnToilet).add($btnFire).add($btnEmergency).add($btnBike);

  const getCurrentGu = () =>
    $("#selected-gu-name")
      .text()
      .replace(/\s*안심·매너$/, "")
      .trim();

  // 버튼 스타일을 직접 style로 제어
  function setActive($btn, activeKey) {
    $allBtns.css({ borderColor: "", background: "" });
    const s = BTN_ACTIVE_STYLE[activeKey];
    $btn.css({ borderColor: s.borderColor, background: s.background });
  }

  function resetBtns() {
    $allBtns.css({ borderColor: "", background: "" });
  }

  async function handleFetch(fetchFn, $btn, emoji, activeKey, loadingMsg) {
    const guName = getCurrentGu();
    if (!guName || guName === "—") return;

    $btn.text("···");
    $(window).trigger("showMapLoading", [true, loadingMsg]);
    try {
      const data = await fetchFn(guName);
      bindMarkers(data);
      $(window).trigger("updateCount", [data.length]);
      $panel.css("transform", "translateY(100%)");
      setActive($btn, activeKey);
    } finally {
      $btn.text(emoji);
      $(window).trigger("showMapLoading", [false]);
    }
  }

  // ── 이벤트 바인딩 ──────────────────────────────────────────────
  $("#close-panel").on("click", () =>
    $panel.css("transform", "translateY(100%)"),
  );
  $("#btn-back").on("click", () => goHome());

  $btnSmoking.on("click", function () {
    handleFetch(
      fetchSmoking,
      $(this),
      "🚬",
      "smoke",
      "LOCATING SMOKING AREAS...",
    );
  });
  $btnToilet.on("click", function () {
    handleFetch(fetchToilet, $(this), "🚽", "toilet", "LOADING RESTROOMS...");
  });
  $btnFire.on("click", function () {
    handleFetch(
      fetchFireStation,
      $(this),
      "🚒",
      "fire",
      "LOCATING FIRE STATIONS...",
    );
  });
  $btnEmergency.on("click", function () {
    handleFetch(
      fetchEmergencyRoom,
      $(this),
      "🏥",
      "emergency",
      "LOADING EMERGENCY ROOMS...",
    );
  });
  $btnBike.on("click", function () {
    handleFetch(
      fetchBikeStation,
      $(this),
      "🚴",
      "bike",
      "LOADING BIKE STATIONS...",
    );
  });

  // main.js에서 발행하는 버튼 관련 이벤트 수신
  $(window).on("setActiveBtn", (_e, key) => {
    const map = { smoke: $btnSmoking, toilet: $btnToilet, fire: $btnFire, emergency: $btnEmergency };
    if (map[key]) setActive(map[key], key);
  });
  $(window).on("resetBtns", resetBtns);

  // ── 마커 클릭 → 정보 패널 ─────────────────────────────────────
  $(window).on("openDetail", function (_e, detail) {
    const { name, address, sub, type } = detail;
    const cfg = TAG_CONFIG[type] || TAG_CONFIG.SMOKE;

    $("#place-title").text(name);
    $("#place-address").text(address || "");
    $("#place-sub").text(sub || "");
    $("#place-tag")
      .text(cfg.label)
      .attr(
        "class",
        `inline-block font-mono text-[0.62rem] font-bold tracking-widest px-2 py-0.5 rounded mb-2 ${cfg.cls}`,
      );

    $panel.css("transform", "translateY(0)");
  });
}
