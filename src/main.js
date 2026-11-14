import "./style.css";
import { initI18n } from "./i18n/index.js";
import { createMoonViewer } from "./globe.js";

initI18n(document.getElementById("lang"));

const viewer = createMoonViewer(document.getElementById("globe"));

// exposto só para depuração no console do navegador
window.__viewer = viewer;
