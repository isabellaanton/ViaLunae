import "./style.css";
import { createMoonViewer } from "./globe.js";

const viewer = createMoonViewer(document.getElementById("globe"));

// exposto só para depuração no console do navegador
window.__viewer = viewer;
