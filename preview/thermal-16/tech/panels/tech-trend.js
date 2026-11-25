// H-05 散熱方式週趨勢 (`07` D-030)
import { fill, el } from "../../lib/dom.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";
import { TREND } from "../common.js";

const W = 560, H = 150; // viewBox; svg 滿格、最小 560px
const svg = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of kids) n.appendChild(k);
  return n;
};
const title = (t) => Object.assign(svg("title"), { textContent: t });
const KEYS = TREND.map((x) => x[0]);
const sum = (trend, ...ks) => trend.reduce((n, w) => n + ks.reduce((m, k) => m + (w.counts[k] || 0), 0), 0);

export function renderTrend(node, { data, loading, error, retry, week, onWeek }) {
  const old = node.querySelector && node.querySelector(".trend-wrap"), kept = old ? old.scrollLeft : null;
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "趨勢");
  const t = data.trend || [];
  if (!sum(t, ...KEYS)) return showEmpty(box, "這個時間窗沒有產品動態");
  const top = Math.max(...t.map((w) => sum([w], ...KEYS)));
  const BAR = W / t.length;
  const bars = t.map((w, i) => {
    let y = H;
    const n = sum([w], ...KEYS);
    const g = svg("g", { class: "wk", "data-week": w.start, "data-n": n, role: "button", tabindex: 0, "aria-pressed": String(week === w.start) },
      svg("rect", { class: "hit", x: i * BAR, y: 0, width: BAR, height: H }));
    for (const [k, label] of TREND) {
      const c = w.counts[k] || 0, h = (c / top) * (H - 4);
      if (c) g.appendChild(svg("rect", { class: `seg k-${k}`, x: i * BAR + 3, y: (y -= h), width: BAR - 6, height: h }, title(`${w.start} ${label} ${c} 篇`)));
    }
    if (!n) g.appendChild(svg("rect", { class: "seg zero", x: i * BAR + 3, y: H - 2, width: BAR - 6, height: 2 }));
    g.addEventListener("click", () => onWeek(week === w.start ? null : w.start));
    return g;
  });
  const axis = t.flatMap((w, i) => (i % 4 === 0 || i === t.length - 1 ? [Object.assign(svg("text", { class: "axis", x: (i + .5) * BAR, y: H + 12 }), { textContent: w.start.slice(5) })] : []));
  const d = sum(t, "DLC_cold_plate", "DLC_other", "DLC_unspecified"), a = sum(t, "1PIC"), b = sum(t, "2PIC");
  const wrap = el("div", { class: "tbl-wrap trend-wrap" }, svg("svg", { class: "trend", viewBox: `0 0 ${W} ${H + 16}` }, ...bars, ...axis));
  fill(box, wrap,
    el("div", { class: "legend" }, ...TREND.map(([k, label]) => el("span", {}, el("i", { class: `sw k-${k}` }), label))),
    el("p", { class: "trend-sum", text: `時間窗內：Air ${sum(t, "Air")}、DLC ${d}（冷板 ${sum(t, "DLC_cold_plate")}）、浸沒 ${a + b}（1PIC ${a}、2PIC ${b}）` }),
    el("p", { class: "note", text: "趨勢不受散熱方式篩選；點一週篩上方產品動態，再點取消。" }));
  wrap.scrollLeft = kept ?? wrap.scrollWidth ?? 0;
}
