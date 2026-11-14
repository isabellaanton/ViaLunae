// Barra de tempo: percorre as amostras do cenário carregado, com animação simples.
import { t, onLangChange } from "./i18n/index.js";

const $ = (id) => document.getElementById(id);
const fmtTime = (iso) => iso.replace("T", " ").replace(/:00Z$|Z$/, "") + " UTC";

export function createTimeline(onIndex) {
  const slider = $("time-slider");
  const label = $("time-label");
  const play = $("btn-play");
  const speed = $("time-speed");
  let samples = null;
  let timer = null;

  function setPlayLabel() {
    const key = timer ? "time.pause" : "time.play";
    play.textContent = timer ? "⏸" : "▶";
    play.title = t(key);
    play.setAttribute("aria-label", t(key));
  }

  function show(i) {
    label.textContent = samples ? fmtTime(samples[i].t) : t("time.none");
    onIndex(i);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    setPlayLabel();
  }

  slider.addEventListener("input", () => show(Number(slider.value)));
  play.addEventListener("click", () => {
    if (!samples) return;
    if (timer) return stop();
    // 1× = período inteiro em ~12 s (30 quadros/s); a posição acumula frações para velocidades baixas
    let pos = Number(slider.value);
    timer = setInterval(() => {
      const perFrame = (samples.length / 360) * Number(speed.value || 1);
      pos = (pos + perFrame) % samples.length;
      const next = Math.floor(pos);
      if (next !== Number(slider.value)) {
        slider.value = next;
        show(next);
      }
    }, 33);
    setPlayLabel();
  });
  onLangChange(setPlayLabel);

  return {
    load(newSamples) {
      stop();
      samples = newSamples;
      slider.max = samples.length - 1;
      slider.value = 0;
      slider.disabled = play.disabled = false;
      show(0);
    },
    clear() {
      stop();
      samples = null;
      slider.value = 0;
      slider.disabled = play.disabled = true;
      label.textContent = t("time.none");
    },
  };
}
