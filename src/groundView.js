// "Ver do chão": câmera a 2 m do solo no local, olhando para o horizonte real (relevo do Cesium Moon),
// com o Sol e a Terra posicionados no céu pela Horizons. Arrastar o mouse olha em volta.
import {
  Cartesian3,
  Cartesian2,
  Color,
  Ellipsoid,
  Transforms,
  Matrix4,
  CameraEventType,
  LabelStyle,
  VerticalOrigin,
  Math as CMath,
} from "cesium";

const SKY_DISTANCE_M = 120_000; // além do relevo próximo; o terreno ainda pode esconder o astro
const EYE_M = 2;

function localDirection(enuToFixed, azDeg, elDeg) {
  const az = CMath.toRadians(azDeg), el = CMath.toRadians(elDeg);
  const local = new Cartesian3(Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el));
  return Matrix4.multiplyByPointAsVector(enuToFixed, local, new Cartesian3());
}

export function createGroundView(viewer) {
  let active = null; // { eye, enu, savedCam, savedCtl, sun, earth }

  function bodyEntity(color, size, text) {
    return viewer.entities.add({
      position: Cartesian3.ZERO,
      point: { pixelSize: size, color, outlineColor: Color.WHITE.withAlpha(0.6), outlineWidth: 1 },
      label: {
        text,
        font: "13px system-ui, sans-serif",
        fillColor: color,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -size),
      },
    });
  }

  function place(entity, azDeg, elDeg) {
    const dir = localDirection(active.enu, azDeg, elDeg);
    entity.position = Cartesian3.add(active.eye, Cartesian3.multiplyByScalar(dir, SKY_DISTANCE_M, new Cartesian3()), new Cartesian3());
  }

  return {
    get active() {
      return Boolean(active);
    },

    enter({ lat, lon, groundHeightM, sample, labels }) {
      if (active) this.exit();
      const ctl = viewer.scene.screenSpaceCameraController;
      const eye = Cartesian3.fromDegrees(lon, lat, groundHeightM + EYE_M, Ellipsoid.MOON);
      active = {
        eye,
        enu: Transforms.eastNorthUpToFixedFrame(eye, Ellipsoid.MOON),
        savedCam: {
          position: viewer.camera.position.clone(),
          direction: viewer.camera.direction.clone(),
          up: viewer.camera.up.clone(),
        },
        savedCtl: {
          enableRotate: ctl.enableRotate,
          enableTranslate: ctl.enableTranslate,
          enableZoom: ctl.enableZoom,
          enableTilt: ctl.enableTilt,
          enableLook: ctl.enableLook,
          lookEventTypes: ctl.lookEventTypes,
        },
        sun: bodyEntity(Color.fromCssColorString("#ffd45e"), 20, labels.sun),
        earth: bodyEntity(Color.fromCssColorString("#6fb7ff"), 24, labels.earth),
      };
      // só olhar em volta (arrastar), sem sair do lugar
      Object.assign(ctl, { enableRotate: false, enableTranslate: false, enableZoom: false, enableTilt: false, enableLook: true });
      ctl.lookEventTypes = CameraEventType.LEFT_DRAG;

      viewer.camera.setView({
        destination: eye,
        orientation: { heading: CMath.toRadians(sample.sunAz), pitch: CMath.toRadians(3), roll: 0 },
      });
      this.update(sample);
    },

    update(sample) {
      if (!active) return;
      place(active.sun, sample.sunAz, sample.sunEl);
      place(active.earth, sample.earthAz, sample.earthEl);
      viewer.scene.requestRender();
    },

    lookAt(azDeg, elDeg = 3) {
      if (!active) return;
      viewer.camera.setView({
        destination: active.eye,
        orientation: { heading: CMath.toRadians(azDeg), pitch: CMath.toRadians(Math.max(-10, Math.min(60, elDeg))), roll: 0 },
      });
    },

    setLabels(labels) {
      if (!active) return;
      active.sun.label.text = labels.sun;
      active.earth.label.text = labels.earth;
    },

    exit() {
      if (!active) return;
      viewer.entities.remove(active.sun);
      viewer.entities.remove(active.earth);
      Object.assign(viewer.scene.screenSpaceCameraController, active.savedCtl);
      viewer.camera.setView({ destination: active.savedCam.position, orientation: { direction: active.savedCam.direction, up: active.savedCam.up } });
      active = null;
    },
  };
}
