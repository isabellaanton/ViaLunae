// Gráfico de linhas em SVG, sem biblioteca: eixos simples, faixas, linha de referência e cursor.
const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/**
 * @param {SVGElement} svg  com viewBox "0 0 W H"
 * @param {{
 *   width?: number, height?: number, pad?: {l,r,t,b},
 *   count: number,                                   // número de amostras (eixo x)
 *   lines: { values: number[], cls: string, axis?: "left"|"right" }[],
 *   left:  { min: number, max: number, ticks: { v: number, label: string }[], cls?: string },
 *   right?:{ min: number, max: number, ticks: { v: number, label: string }[], cls?: string },
 *   refLines?: { v: number, axis?: "left"|"right", cls: string }[],
 *   bands?: { values: boolean[], cls: string }[],      // faixas verticais onde values[i] é verdadeiro
 *   xLabels: [string, string], cursor?: number,
 * }} opts
 */
export function drawLineChart(svg, opts) {
  const W = opts.width ?? 320, H = opts.height ?? 150;
  const pad = opts.pad ?? { l: 34, r: 34, t: 10, b: 20 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = opts.count;
  const x = (i) => pad.l + (n > 1 ? (i / (n - 1)) * iw : 0);
  const yOf = (axis) => {
    const a = axis === "right" ? opts.right : opts.left;
    return (v) => pad.t + ih - ((v - a.min) / (a.max - a.min)) * ih;
  };

  svg.replaceChildren();
  svg.append(el("rect", { x: pad.l, y: pad.t, width: iw, height: ih, class: "ch-bg" }));

  // faixas (ex.: períodos com o astro visível)
  for (const band of opts.bands ?? []) {
    let start = null;
    for (let i = 0; i <= n; i++) {
      const on = i < n && band.values[i];
      if (on && start === null) start = i;
      if (!on && start !== null) {
        const x0 = x(start), x1 = x(Math.min(i, n - 1));
        svg.append(el("rect", { x: x0, y: pad.t, width: Math.max(1, x1 - x0), height: ih, class: band.cls }));
        start = null;
      }
    }
  }

  for (const r of opts.refLines ?? []) {
    const y = yOf(r.axis)(r.v);
    svg.append(el("line", { x1: pad.l, x2: pad.l + iw, y1: y, y2: y, class: r.cls }));
  }

  const text = (txt, xx, yy, anchor, cls) => {
    const t = el("text", { x: xx, y: yy, "text-anchor": anchor, class: cls });
    t.textContent = txt;
    svg.append(t);
  };
  for (const tk of opts.left.ticks) text(tk.label, pad.l - 4, Math.min(pad.t + ih, Math.max(pad.t + 8, yOf("left")(tk.v) + 3)), "end", `ch-txt ${opts.left.cls ?? ""}`);
  if (opts.right) {
    for (const tk of opts.right.ticks) text(tk.label, pad.l + iw + 4, Math.min(pad.t + ih, Math.max(pad.t + 8, yOf("right")(tk.v) + 3)), "start", `ch-txt ${opts.right.cls ?? ""}`);
  }
  text(opts.xLabels[0], pad.l, H - 4, "start", "ch-txt");
  text(opts.xLabels[1], pad.l + iw, H - 4, "end", "ch-txt");

  // linhas (no máximo ~600 pontos para manter o SVG leve)
  const stride = Math.max(1, Math.floor(n / 600));
  for (const line of opts.lines) {
    const y = yOf(line.axis);
    const pts = [];
    for (let i = 0; i < n; i += stride) pts.push(`${x(i).toFixed(1)},${y(line.values[i]).toFixed(1)}`);
    if ((n - 1) % stride) pts.push(`${x(n - 1).toFixed(1)},${y(line.values[n - 1]).toFixed(1)}`);
    svg.append(el("polyline", { points: pts.join(" "), class: line.cls }));
  }

  if (opts.cursor != null) {
    const cx = x(opts.cursor);
    svg.append(el("line", { x1: cx, x2: cx, y1: pad.t, y2: pad.t + ih, class: "ch-cursor" }));
  }
}

/** Escala "bonita" para um intervalo, sempre incluindo o zero */
export function niceRange(values, { minSpan = 10, include = [0] } = {}) {
  let lo = Math.min(...values, ...include), hi = Math.max(...values, ...include);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const span = hi - lo;
  const step = [1, 2, 5, 10, 15, 30, 45, 90].find((s) => span / s <= 4) ?? 90;
  return { min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
}
