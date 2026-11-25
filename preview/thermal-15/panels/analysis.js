// E-12 關聯分析 (`07` v0.7, F4): 兩條件散布圖；Spearman ρ（n ≥ 15 才顯示）
// Not causation; counts from news extraction (English-media bias)
import { el, fill } from "../lib/dom.js";
import { BIVAR_LAYERS, LAYER_BY_ID, layerValue } from "../lib/layers.js";
import { capped } from "../lib/cards.js";
import { CELL_ROWS } from "../config.js";

export const MIN_N = 15;
const NS = "http://www.w3.org/2000/svg";
const W = 420, H = 250, PAD = 34;

function svg(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  return n;
}

function ranks(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

export function spearman(x, y) {
  const rx = ranks(x), ry = ranks(y), n = x.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

export function scatterPoints(countries, x, y) {
  const points = [];
  let excluded = 0;
  for (const [iso, e] of Object.entries(countries || {})) {
    const vx = layerValue(e, x), vy = layerValue(e, y);
    if (vx === null || vy === null) { excluded += 1; continue; }
    points.push({ iso, x: vx, y: vy, deploy: e.events?.deploy || 0, reg: e.events?.reg || 0 });
  }
  return { points, excluded };
}

export function groupByCount(points, axis) {
  const o = axis === "x" ? "y" : "x";
  return ["0 件", "1 件", "≥2 件"].map((label, i) => {
    const v = points.filter((p) => Math.min(p[axis], 2) === i).map((p) => p[o]).sort((a, b) => a - b), m = v.length >> 1;
    return { label, n: v.length, median: v.length ? (v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) : null };
  });
}

export function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => (a[key] == null) - (b[key] == null) || (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0) || (a.iso < b.iso ? -1 : 1));
}

let sort = { key: "x", dir: -1 }, open = false;
const scale = (v, lo, hi, a, b) => (hi === lo ? (a + b) / 2 : a + ((v - lo) / (hi - lo)) * (b - a));
const Z = (id) => LAYER_BY_ID[id].zh;
const label = (id) => `${Z(id)}${LAYER_BY_ID[id].unit ? `（${LAYER_BY_ID[id].unit}）` : "（事件數）"}`;

export function renderAnalysis(node, a) {
  const { countries, x, y, onAxis, onPick, onRow } = a;
  const axis = (k, v) => el("label", { class: "ctl" }, el("span", { class: "ctl-label", text: k === "x" ? "橫軸" : "縱軸" }),
    el("select", { "aria-label": k === "x" ? "橫軸" : "縱軸", onchange: (e) => { open = false; sort = { key: "x", dir: -1 }; onAxis(k, e.target.value); } },
      ...BIVAR_LAYERS.map((id) => el("option", { value: id, selected: id === v, text: Z(id) }))));
  const { points, excluded } = scatterPoints(countries, x, y);
  const ga = ["x", "y"].find((k) => LAYER_BY_ID[k === "x" ? x : y].kind === "count"), groups = ga && groupByCount(points, ga);
  const rho = !ga && points.length >= MIN_N ? spearman(points.map((p) => p.x), points.map((p) => p.y)) : null;
  const plot = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "scatter", role: "img", "aria-label": `${label(x)} × ${label(y)} 散布圖` });
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  plot.append(svg("line", { x1: PAD, y1: H - PAD, x2: W - 8, y2: H - PAD, class: "axis" }), svg("line", { x1: PAD, y1: 8, x2: PAD, y2: H - PAD, class: "axis" }));
  const tick = (x, y, text, anchor) => { const t = svg("text", { x, y, class: "tick", "text-anchor": anchor }); t.textContent = text; return t; };
  const num = (v) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
  if (points.length) plot.append(tick(PAD, H - PAD + 14, num(x0), "start"), tick(W - 8, H - PAD + 14, `${num(x1)} ${Z(x)}`, "end"),
    tick(PAD - 4, H - PAD, num(y0), "end"), tick(PAD - 4, 16, num(y1), "end"), tick(PAD + 4, 12, Z(y), "start"));
  for (const p of points) {
    const c = svg("circle", { cx: scale(p.x, x0, x1, PAD + 6, W - 14).toFixed(1), cy: scale(p.y, y0, y1, H - PAD - 6, 14).toFixed(1),
      r: (3 + Math.sqrt(p.deploy) * 2).toFixed(1), class: `pt reg${Math.min(p.reg, 2)}`, "data-iso": p.iso, tabindex: 0 });
    c.addEventListener("click", () => onPick(p.iso));
    const t = svg("title");
    t.textContent = `${p.iso}：${Z(x)} ${p.x}・${Z(y)} ${p.y}・法規事件 ${p.reg}・部署事件 ${p.deploy}`;
    c.append(t);
    plot.append(c);
  }
  const cols = [["iso", "國家"], ["x", Z(x)], ["y", Z(y)], ["reg", Z("policy")], ["deploy", Z("deploy")]];
  const [list, more] = capped(sortRows(points, sort.key, sort.dir), CELL_ROWS, open, () => { open = !open; renderAnalysis(node, a); }, (p) =>
    el("tr", { tabindex: onRow ? 0 : null, onclick: onRow && (() => onRow(p.iso, a[ga])) },
      ...[p.iso, num(p.x), num(p.y), p.reg, p.deploy].map((t) => el("td", { text: t }))));
  const table = points.length ? [el("table", { class: "small" }, el("thead", {}, el("tr", {}, ...cols.map(([k, zh]) => el("th", {
    tabindex: 0, onclick: () => { sort = { key: k, dir: sort.key === k ? -sort.dir : k === "iso" ? 1 : -1 }; renderAnalysis(node, a); },
    text: zh })))), el("tbody", {}, ...list.children)), more] : null;
  fill(node,
    el("div", { class: "map-ctl-row" }, axis("x", x), axis("y", y)),
    plot,
    el("p", { class: "small", "data-n": String(points.length) },
      `n = ${points.length}・`, ga ? "事件數軸不算相關係數，改看分組" : rho === null
        ? (points.length < MIN_N ? `n < ${MIN_N}，不顯示係數（只看分布）` : "其中一軸沒有變異，無法計算")
        : `Spearman ρ = ${rho.toFixed(2)}`,
      excluded ? `・排除 ${excluded} 國（任一軸未取得，不補值）` : ""),
    groups && el("p", { class: "small" }, groups.map((g) => `${g.label}：${g.n} 國・${LAYER_BY_ID[ga === "x" ? y : x].zh}中位數 ${g.median === null ? "—" : num(g.median)}`).join("；")),
    table,
    el("p", { class: "note", text: "點大小＝部署事件數、顏色＝法規事件數（0／1／≥2）；點擊點＝全頁選該國。相關≠因果；事件數來自新聞抽取，偏向英文媒體。" }));
}
