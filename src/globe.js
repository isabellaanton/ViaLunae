// Globo da Lua com CesiumJS.
// Duas fontes de superfície (Fase 2, testes A e B):
//   "trek": imagem LROC WAC do NASA Moon Trek (WMTS, sem conta) sobre a esfera lunar
//   "ion":  Cesium Moon Terrain (3D Tiles com relevo), asset 2684829 do Cesium ion, exige token
import {
  Viewer,
  Ellipsoid,
  Globe,
  Color,
  Cartesian3,
  Ion,
  WebMapTileServiceImageryProvider,
  GeographicTilingScheme,
  ImageryLayer,
  Credit,
  Cesium3DTileset,
  DirectionalLight,
  Math as CMath,
} from "cesium";

export const ION_MOON_ASSET_ID = 2684829;
const TREK_WAC =
  "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg";

const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
if (token) Ion.defaultAccessToken = token;
export const hasIonToken = Boolean(token);

function trekLayer() {
  const provider = new WebMapTileServiceImageryProvider({
    url: TREK_WAC,
    layer: "LRO_WAC_Mosaic_Global_303ppd_v02",
    style: "default",
    format: "image/jpeg",
    tileMatrixSetID: "default028mm",
    tilingScheme: new GeographicTilingScheme({ ellipsoid: Ellipsoid.MOON }),
    maximumLevel: 8,
    credit: new Credit("LROC WAC mosaic: NASA/GSFC/Arizona State University, via NASA Moon Trek"),
  });
  return new ImageryLayer(provider);
}

export function createMoonViewer(container) {
  // Raio da Lua (1737,4 km) em todo o Cesium: câmera, coordenadas, picking
  Ellipsoid.default = Ellipsoid.MOON;

  const viewer = new Viewer(container, {
    globe: new Globe(Ellipsoid.MOON),
    baseLayer: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    skyAtmosphere: false,
  });

  const { scene } = viewer;
  scene.globe.baseColor = Color.fromCssColorString("#6f6f6f");
  scene.globe.showGroundAtmosphere = false;
  scene.fog.enabled = false;
  scene.backgroundColor = Color.fromCssColorString("#05070d");
  if (scene.sun) scene.sun.show = false; // o Sol do Cesium segue a Terra; usamos nossa própria luz
  if (scene.moon) scene.moon.show = false;

  // luz direcional controlada por nós (direção do Sol vinda da Horizons)
  scene.light = new DirectionalLight({ direction: new Cartesian3(-1, 0, 0), intensity: 2.2 });
  scene.globe.enableLighting = true;
  scene.globe.dynamicAtmosphereLighting = false;

  return viewer;
}

// ---------- fonte da superfície ----------
let currentTileset = null;

export async function setSurface(viewer, source) {
  const { scene } = viewer;
  viewer.imageryLayers.removeAll();
  if (currentTileset) {
    scene.primitives.remove(currentTileset);
    currentTileset = null;
  }

  if (source === "ion") {
    if (!hasIonToken) throw new Error("NO_TOKEN");
    const tileset = await Cesium3DTileset.fromIonAssetId(ION_MOON_ASSET_ID);
    currentTileset = tileset;
    scene.primitives.add(tileset);
    scene.globe.show = false; // o tileset já é a superfície inteira
    return;
  }

  scene.globe.show = true;
  viewer.imageryLayers.add(trekLayer());
}

// ---------- câmera ----------
export function flyToSouthPole(viewer, duration = 1.5) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(0, -90, 600_000, Ellipsoid.MOON),
    orientation: { heading: 0, pitch: -CMath.PI_OVER_TWO, roll: 0 },
    duration,
  });
}

// centerLon: longitude no centro da vista (ex.: ponto subsolar, para ver o lado iluminado)
export function flyToGlobal(viewer, duration = 1.5, centerLon = 0) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(centerLon, -30, 6_000_000, Ellipsoid.MOON),
    orientation: { heading: 0, pitch: -CMath.PI_OVER_TWO, roll: 0 },
    duration,
  });
}

// ---------- iluminação ----------
// Ponto subsolar (lon/lat selenográficos, graus) -> direção da luz no referencial fixo da Lua.
// No Cesium, o referencial "fixo" do globo é o referencial fixo da Lua, porque o elipsoide é lunar.
export function setSunFromSubsolarPoint(viewer, lonDeg, latDeg) {
  const lon = CMath.toRadians(lonDeg);
  const lat = CMath.toRadians(latDeg);
  const toSun = new Cartesian3(
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat)
  );
  // a luz viaja do Sol para a Lua: direção oposta ao vetor "para o Sol"
  viewer.scene.light.direction = Cartesian3.negate(toSun, new Cartesian3());
  viewer.scene.requestRender();
}

// Direção do Sol vista de um ponto (azimute/elevação locais) -> luz do globo.
// Converte a base local (leste, norte, cima) para o referencial fixo da Lua.
// Devolve o ponto subsolar equivalente { lon, lat } em graus.
export function setSunFromLocalAzEl(viewer, latDeg, lonDeg, azDeg, elDeg) {
  const la = CMath.toRadians(latDeg), lo = CMath.toRadians(lonDeg);
  const az = CMath.toRadians(azDeg), el = CMath.toRadians(elDeg);
  const e = Math.sin(az) * Math.cos(el), n = Math.cos(az) * Math.cos(el), u = Math.sin(el);
  const east = [-Math.sin(lo), Math.cos(lo), 0];
  const north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const v = [0, 1, 2].map((k) => east[k] * e + north[k] * n + up[k] * u);
  const lon = CMath.toDegrees(Math.atan2(v[1], v[0]));
  const lat = CMath.toDegrees(Math.asin(Math.max(-1, Math.min(1, v[2]))));
  setSunFromSubsolarPoint(viewer, lon, lat);
  return { lon, lat };
}

// Tileset do Cesium Moon em uso (null quando a superfície é o Moon Trek, sem relevo)
export function getTerrainTileset() {
  return currentTileset;
}
