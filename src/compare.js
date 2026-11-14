// Interface da comparação: lista resumida no painel, tabela completa numa janela e CSV.
import { t, getLang, onLangChange } from "./i18n/index.js";
import { COLUMNS, buildRow, sortRows, bestByColumn, toCsv } from "./compareModel.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "vialunae.compare";
const MAX_SCENARIOS = 12;

function nf(v, digits) {
  return new Intl.NumberFormat(getLang() === "pt" ? "pt-BR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

function formatCell(col, v) {
  if (v == null) return "—";
  if (col.kind === "date") return v.slice(0, 16).replace("T", " ");
  if (col.kind === "num") return `${nf(v, col.digits)}${col.unit && col.unit !== "°" && col.unit !== "%" ? " " : ""}${col.unit ?? ""}`;
  return v;
}

/**
 * @param {{ getPanel: () => object, siteLabel: (query) => string,
 *           loadSeries: (query) => Promise<object>, onEdit: (query) => void }} deps
 */
export function createComparison({ getPanel, siteLabel, loadSeries, onEdit }) {
  const mini = $("cmp-mini"), empty = $("cmp-empty"), table = $("cmp-table"), dialog = $("cmp-dialog");
  const btnOpen = $("cmp-open"), btnCsv = $("cmp-csv"), btnClear = $("cmp-clear");
  let scenarios = []; // { id, query, series }
  let sort = { key: "energyKwh", dir: "desc" };
  let nextId = 1;

  // ---------- persistência das consultas (as séries são recarregadas) ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios.map((s) => ({ ...s.query, start: s.query.start.toISOString() }))));
    } catch {
      // armazenamento bloqueado: a comparação vale só nesta visita
    }
  }

  async function restore() {
    let saved = [];
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      saved = [];
    }
    for (const q of saved.slice(0, MAX_SCENARIOS)) {
      try {
        const query = { ...q, start: new Date(q.start) };
        const { series } = await loadSeries(query);
        scenarios.push({ id: `s${nextId++}`, query, series });
      } catch {
        // cenário que não carrega mais (ex.: sem rede) é descartado
      }
    }
    render();
  }

  function rows() {
    const panel = getPanel();
    return scenarios.map((s) => buildRow(s, panel, siteLabel(s.query) + (s.query.terrain ? " ⛰" : "")));
  }

  // ---------- lista resumida no painel ----------
  function renderMini(all) {
    empty.hidden = all.length > 0;
    btnOpen.disabled = btnCsv.disabled = btnClear.disabled = all.length === 0;
    mini.replaceChildren(
      ...all.map((r) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "cmp-name";
        name.textContent = `${r.site} · ${r.start.slice(0, 10)} · ${t("cmp.daysShort", { d: r.days })}`;
        const val = document.createElement("span");
        val.className = "cmp-val";
        val.textContent = `${nf(r.powerMeanKw, 2)} kW · ${nf(r.sunPct, 0)}% ☀ · ${nf(r.earthPct, 0)}% 🌍`;
        li.append(name, val);
        return li;
      })
    );
  }

  // ---------- tabela completa ----------
  function renderTable(all) {
    const sorted = sortRows(all, sort.key, sort.dir);
    const best = bestByColumn(all);
    const panel = getPanel();
    $("cmp-panel-note").textContent = t("cmp.panelNote", {
      area: nf(panel.areaM2, 1),
      eff: nf(panel.efficiency * 100, 0),
      mode: t({ "vertical-tracking": "solar.modeVertical", "dual-axis": "solar.modeDual", fixed: "solar.modeFixed" }[panel.mode]),
    });

    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const col of COLUMNS) {
      const th = document.createElement("th");
      th.scope = "col";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "th-btn";
      const arrow = sort.key === col.key ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
      b.textContent = t(col.label) + arrow;
      if (sort.key === col.key) th.setAttribute("aria-sort", sort.dir === "asc" ? "ascending" : "descending");
      b.addEventListener("click", () => {
        sort = sort.key === col.key ? { key: col.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: col.kind === "text" ? "asc" : "desc" };
        renderTable(rows());
      });
      th.append(b);
      hr.append(th);
    }
    const thActions = document.createElement("th");
    thActions.textContent = t("cmp.actions");
    hr.append(thActions);
    thead.append(hr);

    const tbody = document.createElement("tbody");
    for (const r of sorted) {
      const tr = document.createElement("tr");
      for (const col of COLUMNS) {
        const td = document.createElement(col.key === "site" ? "th" : "td");
        if (col.key === "site") td.scope = "row";
        td.textContent = formatCell(col, r[col.key]);
        if (col.kind === "num") td.className = "num";
        if (best[col.key] === r.id) td.classList.add("best");
        tr.append(td);
      }
      const act = document.createElement("td");
      act.className = "actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "ghost small-btn";
      edit.textContent = t("cmp.edit");
      edit.title = t("cmp.editHint");
      edit.addEventListener("click", () => {
        const s = scenarios.find((x) => x.id === r.id);
        dialog.close();
        onEdit(s.query);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "ghost small-btn danger";
      del.textContent = t("cmp.remove");
      del.addEventListener("click", () => {
        scenarios = scenarios.filter((x) => x.id !== r.id);
        save();
        render();
        if (!scenarios.length) dialog.close();
      });
      act.append(edit, del);
      tr.append(act);
      tbody.append(tr);
    }
    table.replaceChildren(thead, tbody);
  }

  function render() {
    const all = rows();
    renderMini(all);
    if (dialog.open) renderTable(all);
  }

  function downloadCsv() {
    const all = sortRows(rows(), sort.key, sort.dir);
    const csv = "﻿" + toCsv(all, t, getPanel()); // BOM: acentos corretos no Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vialunae-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  btnOpen.addEventListener("click", () => {
    renderTable(rows());
    dialog.showModal();
  });
  $("cmp-close").addEventListener("click", () => dialog.close());
  btnCsv.addEventListener("click", downloadCsv);
  $("cmp-csv2").addEventListener("click", downloadCsv);
  btnClear.addEventListener("click", () => {
    scenarios = [];
    save();
    render();
  });
  onLangChange(render);

  restore();

  return {
    /** @returns {"added" | "duplicate" | "full"} */
    add(result) {
      const q = result.query;
      const same = scenarios.some(
        (s) => s.query.lat === q.lat && s.query.lon === q.lon && s.query.days === q.days && +s.query.start === +q.start && !!s.query.terrain === !!q.terrain
      );
      if (same) return "duplicate";
      if (scenarios.length >= MAX_SCENARIOS) return "full";
      scenarios.push({ id: `s${nextId++}`, query: { ...q }, series: result.series });
      save();
      render();
      return "added";
    },
    rerender: render,
  };
}
