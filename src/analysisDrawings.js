// Desenhos simples (SVG) que explicam cada critério. Usam currentColor e as cores do semáforo.
const SUN = `<circle cx="20" cy="18" r="8" fill="#ffd45e"/>`;
const GROUND = `<path d="M0 66 H160" stroke="#8a8f98" stroke-width="2"/>`;
const EARTH = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="#6fb7ff"/><path d="M${x - 4} ${y - 2} q3 -3 6 0 t4 3" stroke="#2e7d32" stroke-width="2" fill="none"/>`;
const LANDER = (x, y, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-10" y="-16" width="20" height="14" rx="2" fill="#c9ced6"/><path d="M-10 -2 L-15 8 M10 -2 L15 8" stroke="#c9ced6" stroke-width="2"/><rect x="-2" y="-30" width="4" height="14" fill="#5d9cec"/><path d="M0 -30 l8 -6" stroke="#c9ced6" stroke-width="2"/></g>`;
const svg = (body) => `<svg viewBox="0 0 160 80" width="160" height="80" role="img" aria-hidden="true">${body}</svg>`;

export const DRAWINGS = {
  panels: svg(
    `${SUN}<path d="M28 22 L92 46 M26 28 L88 54 M30 16 L96 38" stroke="#ffd45e" stroke-width="1.5" stroke-dasharray="4 3"/>${GROUND}
     <rect x="96" y="26" width="6" height="40" fill="#5d9cec" transform="rotate(-20 99 46)"/>
     <path d="M118 40 a14 14 0 0 1 0 20" stroke="currentColor" fill="none"/>`
  ),
  moduleTilt: svg(`${GROUND}${LANDER(80, 62, 18)}${EARTH(140, 20)}<path d="M88 36 L134 22" stroke="#6fb7ff" stroke-dasharray="3 3"/><path d="M60 66 a22 22 0 0 1 8 -16" stroke="currentColor" fill="none"/>`),
  slope: svg(`${SUN}<path d="M0 70 L160 40 L160 80 L0 80 Z" fill="#5a5f68"/><path d="M28 22 L80 52" stroke="#ffd45e" stroke-dasharray="4 3"/>`),
  relief: svg(`<circle cx="138" cy="16" r="8" fill="#ffd45e"/><path d="M0 66 L40 66 L70 30 L95 66 L160 66" fill="#5a5f68" stroke="#8a8f98"/><path d="M130 20 L70 32" stroke="#ffd45e" stroke-dasharray="4 3"/>${LANDER(20, 64)}<path d="M28 50 L66 34" stroke="#e74c3c" stroke-dasharray="3 3"/>`),
  temperature: svg(`<path d="M10 66 Q80 20 150 66" fill="none" stroke="#8a8f98" stroke-width="2"/><rect x="72" y="22" width="10" height="38" rx="5" fill="none" stroke="currentColor"/><rect x="74" y="40" width="6" height="18" fill="#6fb7ff"/><circle cx="77" cy="62" r="7" fill="#6fb7ff"/>`),
  libration: svg(`${GROUND}${LANDER(30, 64)}${EARTH(130, 58)}<path d="M120 50 q10 -10 20 0" stroke="currentColor" fill="none" stroke-dasharray="2 2"/><path d="M40 36 L122 56" stroke="#6fb7ff" stroke-dasharray="3 3"/>`),
  power: svg(`${SUN}<path d="M80 14 L66 44 H80 L72 70 L98 34 H84 L94 14 Z" fill="#ffd45e"/>`),
  lightRun: svg(`<path d="M10 66 Q80 -6 150 66" fill="none" stroke="#ffd45e" stroke-dasharray="4 3"/><circle cx="118" cy="30" r="7" fill="#ffd45e"/>${GROUND}<circle cx="44" cy="44" r="12" fill="none" stroke="currentColor"/><path d="M44 36 V44 L50 48" stroke="currentColor"/>`),
  night: svg(`<rect width="160" height="80" fill="#0b1020"/>${GROUND}<circle cx="40" cy="30" r="12" fill="none" stroke="currentColor"/><path d="M40 22 V30 L46 34" stroke="currentColor"/>`),
  sunEarth: svg(`${SUN}${GROUND}${LANDER(80, 64)}${EARTH(140, 22)}<path d="M28 22 L74 40" stroke="#ffd45e" stroke-dasharray="4 3"/><path d="M88 36 L132 24" stroke="#6fb7ff" stroke-dasharray="3 3"/>`),
  shadow: svg(`<circle cx="150" cy="54" r="6" fill="#ffd45e"/>${GROUND}${LANDER(118, 64)}<path d="M108 66 L20 66" stroke="#111" stroke-width="6"/>`),
};
