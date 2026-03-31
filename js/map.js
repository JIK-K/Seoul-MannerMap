// js/map.js
import $ from "jquery";

let map = null;
let clusterer = null;
let markers = [];
let myMarker = null;

export function initMap(containerId, center) {
  if (typeof kakao === "undefined" || !kakao.maps) {
    console.error("카카오맵 객체가 아직 준비되지 않았습니다.");
    return;
  }

  if (map) {
    moveTo(center);
    return;
  }

  const container = document.getElementById(containerId);
  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(center.lat, center.lng),
    level: 4,
  });

  clusterer = new kakao.maps.MarkerClusterer({
    map,
    averageCenter: true,
    minLevel: 6,
  });
}

export function moveTo(coords) {
  if (!map) return;
  map.setCenter(new kakao.maps.LatLng(coords.lat, coords.lng));
}

export function bindMarkers(dataList) {
  if (clusterer) clusterer.clear();
  $.each(markers, (_, m) => m.setMap(null));
  markers = [];

  const newMarkers = $.map(dataList, (item) => {
    const marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(item.lat, item.lng),
    });

    kakao.maps.event.addListener(marker, "click", () => {
      $(window).trigger("openDetail", [item]);
    });

    return marker;
  });

  markers = newMarkers;
  if (clusterer) clusterer.addMarkers(newMarkers);
}

export function setMyLocateMarker(coords) {
  if (!map) return;

  if (myMarker) {
    myMarker.setMap(null);
  }

  const image = new kakao.maps.MarkerImage(
    "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png",
    new kakao.maps.Size(35, 35),
  );

  myMarker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(coords.lat, coords.lng),
    image: image,
    map: map,
  });

  myMarker.setMap(map);

  // map.panTo(new kakao.maps.LatLng(coords.lat, coords.lng));
}

export function getNearest(myLat, myLng, dataList) {
  if (!dataList || dataList.length === 0) return null;

  return dataList.reduce((prev, curr) => {
    const distPrev = Math.hypot(myLat - prev.lat, myLng - prev.lng);
    const distCurr = Math.hypot(myLat - curr.lat, myLng - curr.lng);
    return distCurr < distPrev ? curr : prev;
  });
}
