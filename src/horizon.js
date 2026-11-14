// Perfil do horizonte real de um ponto, amostrando o relevo do Cesium Moon (3D Tiles) no navegador.
//
// Para cada azimute, mede a elevação angular do terreno em várias distâncias (até 150 km)
// e guarda a maior: é o ângulo acima do qual o Sol ou a Terra ficam visíveis naquela direção.
// A curvatura da Lua entra automaticamente porque o ângulo é calculado em 3D.
//
// Duas passadas de câmera: alta (vê a região inteira, relevo distante em resolução média)
// e baixa (relevo próximo em resolução alta). sampleHeight usa os tiles já carregados na tela.
import { Cartesian3, Cartographic, Ellipsoid, Math as CMath } from "cesium";

export const AZ_STEP_DEG = 2;
const NEAR_KM = [0.15, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6.5, 8];
const FAR_KM = [10, 13, 16, 20, 25, 30, 37, 45, 55, 65, 80, 95, 110, 130, 150];
const EYE_HEIGHT_M = 2;
const R_MOON = Ellipsoid.MOON.maximumRadius;

// ponto à distância d (m) e azimute az (rad) de (lat, lon) na esfera: fórmula do destino
function destination(latR, lonR, azR, dM) {
  const δ = dM / R_MOON;
  const lat2 = Math.asin(Math.sin(latR) * Math.cos(δ) + Math.cos(latR) * Math.sin(δ) * Math.cos(azR));
  const lon2 = lonR + Math.atan2(Math.sin(azR) * Math.sin(δ) * Math.cos(latR), Math.cos(δ) - Math.sin(latR) * Math.sin(lat2));
  return new Cartographic(lon2, lat2, 0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Renderiza manualmente (funciona mesmo com a aba em segundo plano, onde requestAnimationFrame pausa)
async function waitTiles(viewer, tileset, timeoutMs = 30_000) {
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) {
    viewer.render();
    await sleep(30);
  }
  while (performance.now() - t0 < timeoutMs) {
    viewer.render();
    if (tileset.tilesLoaded) return true;
    await sleep(60);
  }
  return false;
}

function setTopDown(viewer, latD, lonD, heightM) {
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(lonD, latD, heightM, Ellipsoid.MOON),
    orientation: { heading: 0, pitch: -CMath.PI_OVER_TWO, roll: 0 },
  });
}

/**
 * @returns {Promise<{ lat, lon, azStepDeg, horizon: number[], groundHeightM, maxRangeKm, source, complete: boolean }>}
 */
export async function computeHorizonProfile(viewer, tileset, latD, lonD, onProgress) {
  const scene = viewer.scene;
  if (!scene.sampleHeightSupported) throw new Error("sampleHeight não suportado neste navegador");
  const latR = CMath.toRadians(latD), lonR = CMath.toRadians(lonD);
  const nAz = Math.round(360 / AZ_STEP_DEG);
  const saved = { position: viewer.camera.position.clone(), direction: viewer.camera.direction.clone(), up: viewer.camera.up.clone() };
  const sample = (carto) => scene.sampleHeight(carto, undefined, 1);

  const best = new Array(nAz).fill(-90);
  let missing = 0, total = 0, h0 = undefined, complete = true;

  try {
    const passes = [
      { heightM: 420_000, dists: FAR_KM },
      { heightM: 30_000, dists: NEAR_KM },
    ];
    for (let p = 0; p < passes.length; p++) {
      setTopDown(viewer, latD, lonD, passes[p].heightM);
      complete = (await waitTiles(viewer, tileset)) && complete;
      // altura do chão no ponto: usa a passada mais detalhada disponível
      const here = sample(new Cartographic(lonR, latR, 0));
      if (here !== undefined) h0 = here;
      if (h0 === undefined) continue;
      const eye = Ellipsoid.MOON.cartographicToCartesian(new Cartographic(lonR, latR, h0 + EYE_HEIGHT_M));
      const up = Ellipsoid.MOON.geodeticSurfaceNormal(eye, new Cartesian3());
      const v = new Cartesian3();
      for (let a = 0; a < nAz; a++) {
        const azR = CMath.toRadians(a * AZ_STEP_DEG);
        for (const dKm of passes[p].dists) {
          const c = destination(latR, lonR, azR, dKm * 1000);
          const h = sample(c);
          total++;
          if (h === undefined) {
            missing++;
            continue;
          }
          c.height = h;
          Cartesian3.subtract(Ellipsoid.MOON.cartographicToCartesian(c), eye, v);
          const elev = CMath.toDegrees(Math.asin(Cartesian3.dot(v, up) / Cartesian3.magnitude(v)));
          if (elev > best[a]) best[a] = elev;
        }
      }
      onProgress?.((p + 1) / passes.length);
    }
  } finally {
    viewer.camera.setView({ destination: saved.position, orientation: { direction: saved.direction, up: saved.up } });
  }
  if (h0 === undefined) throw new Error("sem relevo carregado neste ponto");

  return {
    lat: latD,
    lon: lonD,
    azStepDeg: AZ_STEP_DEG,
    horizon: best.map((e) => Math.round(e * 100) / 100),
    groundHeightM: Math.round(h0),
    maxRangeKm: FAR_KM[FAR_KM.length - 1],
    missingFraction: total ? Math.round((missing / total) * 1000) / 1000 : 1,
    complete,
    source: "Cesium Moon Terrain (Cesium ion asset 2684829)",
  };
}

/** Elevação do horizonte num azimute qualquer (interpolação linear entre amostras) */
export function horizonAt(profile, azDeg) {
  if (!profile) return 0;
  const h = profile.horizon, step = profile.azStepDeg, n = h.length;
  const x = (((azDeg % 360) + 360) % 360) / step;
  const i = Math.floor(x) % n, j = (i + 1) % n, f = x - Math.floor(x);
  return h[i] * (1 - f) + h[j] * f;
}

/** Acrescenta às amostras a elevação do horizonte na direção do Sol e da Terra (sunHz, earthHz) */
export function applyHorizon(samples, profile) {
  if (!profile) return samples.map(({ sunHz, earthHz, ...s }) => s);
  return samples.map((s) => ({ ...s, sunHz: horizonAt(profile, s.sunAz), earthHz: horizonAt(profile, s.earthAz) }));
}
