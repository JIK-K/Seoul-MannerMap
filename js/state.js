// js/state.js — 순환 import 방지용 공유 상태/이벤트 브릿지
import $ from "jquery";

// ui.js → main.js 방향 호출을 이벤트로 대체
export function goHome() {
  $(window).trigger("goHome");
}
