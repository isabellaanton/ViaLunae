// Globo da Lua com CesiumJS.
// Fase 0: esfera lunar cinza, sem imagem. A imagem/terreno reais entram na Fase 2.
import {
  Viewer,
  Ellipsoid,
  Globe,
  Color,
  Cartesian3,
  Ion,
} from "cesium";

const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
if (token) Ion.defaultAccessToken = token;

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
  scene.globe.baseColor = Color.fromCssColorString("#8a8a8a");
  scene.globe.showGroundAtmosphere = false;
  scene.fog.enabled = false;
  scene.backgroundColor = Color.fromCssColorString("#05070d");

  // começa olhando para o polo sul
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(0, -60, 4_500_000, Ellipsoid.MOON),
    orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
  });

  return viewer;
}
