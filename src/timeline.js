// Barra de tempo: percorre as amostras do cenário carregado, com animação simples.
import { t, onLangChange } from "./i18n/index.js";

const $ = (id) => document.getElementById(id);
const fmtTime = (iso) => iso.replace("T", " ").replace(/:00Z$|Z$/, "") + " UTC";

export function createTimeline(onIndex) {
  const slider = $("time-slider");
  const label = $("time-label");
  const play = $("btn-play");
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
    // ~12 s para percorrer o período inteiro, no máximo 30 quadros por segundo
    const step = Math.max(1, Math.round(samples.length / 360));
    timer = setInterval(() => {
      const next = (Number(slider.value) + step) % samples.length;
      slider.value = next;
      show(next);
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
