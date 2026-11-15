// Marcadores dos locais no globo, seleção por clique e escolha de coordenadas livres.
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  Ellipsoid,
  HeightReference,
  LabelStyle,
  VerticalOrigin,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  NearFarScalar,
  Math as CMath,
  defined,
} from "cesium";
import { interaction } from "./interaction.js";

const COLORS = {
  apollo: Color.fromCssColorString("#9ecbff"),
  southpole: Color.fromCssColorString("#ffd45e"),
  custom: Color.fromCssColorString("#ff6b6b"),
};

function pointStyle(color, selected = false) {
  return {
    pixelSize: selected ? 14 : 10,
    color,
    outlineColor: selected ? Color.WHITE : Color.BLACK,
    outlineWidth: 2,
    heightReference: HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  };
}

function labelStyle(text) {
  return {
    text,
    font: "13px system-ui, sans-serif",
    fillColor: Color.WHITE,
    outlineColor: Color.BLACK,
    outlineWidth: 3,
    style: LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: VerticalOrigin.BOTTOM,
    pixelOffset: new Cartesian2(0, -12),
    heightReference: HeightReference.CLAMP_TO_GROUND,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    // some de longe para não poluir o globo inteiro
    translucencyByDistance: new NearFarScalar(1.5e6, 1.0, 5e6, 0.0),
  };
}

const position = (lon, lat) => Cartesian3.fromDegrees(lon, lat, 0, Ellipsoid.MOON);

export function createMarkers(viewer, { onSelectSite, onPickCoordinate }) {
  const byId = new Map();
  let selectedId = null;
  let customEntity = null;
  let pickMode = false;
  let scoreColors = null; // { siteId: Color } quando a análise está ligada
  const colorOf = (e) => scoreColors?.[e.__site.id] ?? COLORS[e.__site.group] ?? COLORS.apollo;

  function addSites(sites, lang) {
    for (const s of sites) {
      const e = viewer.entities.add({
        id: `site:${s.id}`,
        position: position(s.lon, s.lat),
        point: pointStyle(COLORS[s.group] ?? COLORS.apollo),
        label: labelStyle(s.name[lang] ?? s.name.en),
      });
      e.__site = s;
      byId.set(s.id, e);
    }
  }

  function setLang(lang) {
    for (const e of byId.values()) e.label.text = e.__site.name[lang] ?? e.__site.name.en;
  }

  function highlight(id) {
    if (selectedId && byId.has(selectedId)) {
      const prev = byId.get(selectedId);
      Object.assign(prev.point, pointStyle(colorOf(prev), false));
    }
    selectedId = id;
    if (id && byId.has(id)) {
      const e = byId.get(id);
      Object.assign(e.point, pointStyle(colorOf(e), true));
    }
  }

  function setCustom(lat, lon) {
    if (lat === null) {
      if (customEntity) viewer.entities.remove(customEntity);
      customEntity = null;
      return;
    }
    if (!customEntity) {
      customEntity = viewer.entities.add({
        id: "custom",
        position: position(lon, lat),
        point: pointStyle(COLORS.custom, true),
      });
    } else {
      customEntity.position = position(lon, lat);
    }
  }

  // cores da pontuação da análise (CSS por id) ou null para voltar às cores dos grupos
  function setScoreColors(map) {
    scoreColors = map ? Object.fromEntries(Object.entries(map).map(([id, c]) => [id, Color.fromCssColorString(c)])) : null;
    for (const e of byId.values()) Object.assign(e.point, pointStyle(colorOf(e), e.__site.id === selectedId));
    viewer.scene.requestRender();
  }

  function setPickMode(on) {
    pickMode = on;
    viewer.container.style.cursor = on ? "crosshair" : "";
  }

  // clique: marcador -> seleciona o sítio; no modo de coordenadas livres -> escolhe o ponto clicado
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((ev) => {
    if (interaction.measuring) return; // ferramenta de medida ativa
    const picked = viewer.scene.pick(ev.position);
    const site = picked?.id?.__site;
    if (site) {
      onSelectSite(site);
      return;
    }
    if (!pickMode) return;
    let cart = viewer.scene.pickPositionSupported ? viewer.scene.pickPosition(ev.position) : undefined;
    if (!defined(cart)) cart = viewer.camera.pickEllipsoid(ev.position, Ellipsoid.MOON);
    if (!defined(cart)) return;
    const c = Cartographic.fromCartesian(cart, Ellipsoid.MOON);
    onPickCoordinate(CMath.toDegrees(c.latitude), CMath.toDegrees(c.longitude));
  }, ScreenSpaceEventType.LEFT_CLICK);

  return { addSites, setLang, highlight, setCustom, setPickMode, setScoreColors };
}

export function flyToSite(viewer, lat, lon, duration = 1.5) {
  // perto dos polos, uma vista mais alta mostra o contexto da região
  const height = Math.abs(lat) > 75 ? 220_000 : 160_000;
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, height, Ellipsoid.MOON),
    orientation: { heading: 0, pitch: -CMath.PI_OVER_TWO, roll: 0 },
    duration,
  });
}
