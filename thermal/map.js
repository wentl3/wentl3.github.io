// E-01／02／08／09／10／11 (`07` v0.7); SVG via d3-geo, no 3D
import { totalCount } from "./lib/counts.js";
import { BIVAR_LAYERS, LAYER_BY_ID, bivariateClass, fillForLayer, layerTip, matchesRule } from "./lib/layers.js";
import { CONSTRAINT_ZH, countryZh } from "./lib/format.js";
import { largestPolygon } from "./lib/geo.js";

const NS = "http://www.w3.org/2000/svg";
const W = 960, H = 500;

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

export function createMap(svg, topo, numToA2, onSelect, onHub, onEvent = () => {}) {
  const { d3, topojson } = window;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const features = topojson.feature(topo, topo.objects.countries).features;
  const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" });
  const path = d3.geoPath(proj);

  const defs = svgEl("defs");
  const hatch = svgEl("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  hatch.append(svgEl("rect", { width: 6, height: 6, class: "hatch-bg" }), svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "hatch-line" }));
  defs.append(hatch);
  const root = svgEl("g");
  const gC = svgEl("g"), gD = svgEl("g"), gK = svgEl("g"), gH = svgEl("g"), gE = svgEl("g");
  root.append(svgEl("path", { d: path({ type: "Sphere" }), class: "sphere" }), gC, gD, gK, gH, gE);
  svg.append(defs, root);

  const byIso = new Map();
  for (const f of features) {
    const iso = numToA2.get(String(f.id).padStart(3, "0"));
    if (!iso) continue;
    const p = svgEl("path", { d: path(f), class: "country land", "data-iso": iso, tabindex: -1 });
    const title = svgEl("title");
    p.append(title);
    p.addEventListener("click", () => onSelect(iso));
    gC.append(p);
    const main = largestPolygon(f.geometry);
    byIso.set(iso, { node: p, title, center: main ? proj(d3.geoCentroid(main)) : null });
  }

  // viewBox zoom (no d3-zoom: G5 cap)
  let view = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  const zoomAt = (k, cx, cy) => {
    const w = Math.min(W, Math.max(W / 8, view.w / k)), h = (w * H) / W;
    view = { x: Math.min(W - w, Math.max(0, cx - ((cx - view.x) * w) / view.w)), y: Math.min(H - h, Math.max(0, cy - ((cy - view.y) * h) / view.h)), w, h };
    apply();
  };
  const toSvg = (e) => {
    const r = svg.getBoundingClientRect();
    return [view.x + ((e.clientX - r.left) / r.width) * view.w, view.y + ((e.clientY - r.top) / r.height) * view.h];
  };
  svg.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = toSvg(e); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, x, y); }, { passive: false });
  let drag = null;
  svg.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, v: { ...view }, moved: false }; });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = svg.getBoundingClientRect();
    const dx = ((e.clientX - drag.x) / r.width) * drag.v.w, dy = ((e.clientY - drag.y) / r.height) * drag.v.h;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    view = { ...drag.v, x: Math.min(W - drag.v.w, Math.max(0, drag.v.x - dx)), y: Math.min(H - drag.v.h, Math.max(0, drag.v.y - dy)) };
    apply();
  });
  window.addEventListener("pointerup", () => { drag = null; });
  svg.addEventListener("click", (e) => { if (drag && drag.moved) e.stopPropagation(); }, true);

  return {
    zoomIn: () => zoomAt(1.5, view.x + view.w / 2, view.y + view.h / 2),
    zoomOut: () => zoomAt(1 / 1.5, view.x + view.w / 2, view.y + view.h / 2),
    reset: () => { view = { x: 0, y: 0, w: W, h: H }; apply(); },
    update(countries, sel, opt) {
      const st = { painted: 0, classes: new Set(), highlighted: 0, hubDots: 0, consDots: 0, pins: { site: 0, hub: 0 } };
      for (const g of [gD, gK, gH, gE]) while (g.firstChild) g.removeChild(g.firstChild);
      const crossing = sel.x && BIVAR_LAYERS.includes(sel.mode) && sel.x !== sel.mode;
      const filtering = sel.filt === "1" && opt.rule && opt.rule.length;
      for (const [iso, rec] of byIso) {
        const entry = countries[iso];
        let cls, label;
        if (crossing) {
          const b = entry ? bivariateClass(entry, sel.mode, sel.x, opt.cuts3) : null;
          cls = b || (entry ? "hatch" : "land");
          label = b ? `${LAYER_BY_ID[sel.mode].zh} × ${LAYER_BY_ID[sel.x].zh}：第 ${Number(b[1]) + 1}／${Number(b[2]) + 1} 級` : "兩項之一未取得";
        } else {
          ({ cls, label } = fillForLayer(entry, sel.mode, opt.cuts4));
        }
        if (!["land", "hatch"].includes(cls)) { st.painted += 1; st.classes.add(cls); }
        let dim = false;
        if (filtering) {
          const m = matchesRule(entry, opt.rule);
          if (m === true) st.highlighted += 1;
          dim = m !== true;
          label += m === true ? "・符合條件" : m === false ? "・不符合" : "・條件無資料";
        }
        rec.node.setAttribute("class", `country ${cls}${dim ? " dim" : ""}${iso === sel.country ? " sel" : ""}`);
        rec.title.textContent = crossing ? `${countryZh(iso)}：${label}` : layerTip(countryZh(iso), sel.mode, label, entry);
        const t = totalCount(entry && entry.counts);
        if (opt.overlays.dots && rec.center && t.accepted + t.unverified > 0) {
          const n = t.accepted + t.unverified;
          const dot = svgEl("circle", { cx: rec.center[0].toFixed(1), cy: rec.center[1].toFixed(1), r: Math.min(3 + Math.sqrt(n) * 2.2, 13).toFixed(1),
            class: `dot${t.unverified ? " hollow" : ""}${iso === sel.country ? " sel" : ""}`, "data-iso": iso });
          const tt = svgEl("title");
          tt.textContent = `${countryZh(iso)}：${n} 則${t.unverified ? `（含未驗證 ${t.unverified}）` : ""}`;
          dot.append(tt);
          dot.addEventListener("click", () => onSelect(iso));
          gD.append(dot);
        }
        const cons = Object.entries((entry && entry.constraints) || {});
        if (opt.overlays.cons && rec.center && cons.length) {
          const [x, y] = rec.center;
          const mark = svgEl("rect", { x: (x + 5).toFixed(1), y: (y - 11).toFixed(1), width: 7, height: 7, transform: `rotate(45 ${(x + 8.5).toFixed(1)} ${(y - 7.5).toFixed(1)})`,
            class: "cons", "data-iso": iso });
          const tt = svgEl("title");
          tt.textContent = `${countryZh(iso)} 限制訊號：${cons.map(([k, n]) => `${CONSTRAINT_ZH[k] || k} ${n}`).join("、")}（新聞抽取；沒有點≠沒有限制）`;
          mark.append(tt);
          mark.addEventListener("click", () => onSelect(iso));
          gK.append(mark);
          st.consDots += 1;
        }
      }
      if (opt.overlays.hubs) {
        for (const h of opt.hubs || []) {
          const p = proj([h.lon, h.lat]);
          if (!p) continue;
          const n = h.counts?.items || 0;
          const power = Object.keys(h.counts?.constraints || {}).some((k) => k.startsWith("grid") || k === "generation_expansion");
          const c = svgEl("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: (3 + Math.sqrt(n) * 1.8).toFixed(1),
            class: `hub${power ? " power" : ""}${h.id === sel.hub ? " sel" : ""}`, "data-hub": h.id });
          const tt = svgEl("title");
          tt.textContent = `${h.name_zh}（樞紐）：相關情報 ${n} 則${power ? "・有電力限制訊號" : ""}`;
          c.append(tt);
          c.addEventListener("click", (e) => { e.stopPropagation(); onHub(h.id); });
          gH.append(c);
          st.hubDots += 1;
        }
      }
      if (opt.overlays.pins) { // E-11: site／hub precision only
        for (const ev of opt.events || []) {
          if (ev.geo_precision === "country" || typeof ev.lat !== "number" || typeof ev.lon !== "number") continue;
          const p = proj([ev.lon, ev.lat]);
          if (!p) continue;
          const [x, y] = p;
          const pin = svgEl("path", { d: `M${x.toFixed(1)} ${y.toFixed(1)}l-3.5 -7a3.6 3.6 0 1 1 7 0z`, class: `pin ${ev.geo_precision}`,
            "data-event": ev.id, "data-geo": ev.geo_precision });
          const tt = svgEl("title");
          tt.textContent = `${ev.headline}（${ev.city || ""}・${ev.geo_precision === "site" ? "廠址" : "樞紐"}）`;
          pin.append(tt);
          pin.addEventListener("click", (e) => { e.stopPropagation(); onEvent(ev); });
          gE.append(pin);
          st.pins[ev.geo_precision] += 1;
        }
      }
      return st;
    },
  };
}
