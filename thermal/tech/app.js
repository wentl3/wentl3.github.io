// 第二頁 (`07` D-029): one state {days, cool, conf} drives H-02～H-06; /products is read once per change. DOM-free so tests can drive it.
import { getJson } from "../api.js";
import { watchRun } from "../panels/topbar.js";
import { describe, parseTech, productsParams, techQuery } from "./common.js";
import { renderAssoc } from "./panels/tech-assoc.js";
import { renderConf } from "./panels/tech-conf.js";
import { renderHeader } from "./panels/tech-header.js";
import { renderMatrix } from "./panels/tech-matrix.js";
import { renderProducts } from "./panels/tech-products.js";
import { renderTrend } from "./panels/tech-trend.js";

export function mountTech(nodes, { fetchJson = getJson, search = "", save = () => {}, watch = watchRun } = {}) {
  const s = { ...parseTech(search), confs: [], meta: null, metaError: null, data: null, error: null, loading: true, focus: null, week: null, open: new Set(), all: false };
  let seq = 0;
  const head = () => renderHeader(nodes.header, { days: s.days, cool: s.cool, conf: s.conf, confs: s.confs, meta: s.meta, metaError: s.metaError,
    onDays: (days) => set({ days }), onCool: (cool) => set({ cool }), onConf: (conf) => set({ conf }) });
  const paint = () => {
    const c = { data: s.data, loading: s.loading, error: s.error, retry: load, days: s.days, win: s.conf ? "展會期間" : `近 ${s.days} 天`, cool: s.cool, conf: s.conf, focus: s.focus, week: s.week };
    head();
    renderProducts(nodes.products, { ...c, expanded: s.open, onClearFocus: () => { s.focus = null; paint(); }, onClearWeek: () => { s.week = null; paint(); },
      onToggle: (k) => { s.open.has(k) ? s.open.delete(k) : s.open.add(k); paint(); } });
    renderMatrix(nodes.matrix, { ...c, all: s.all, onAll: () => { s.all = !s.all; paint(); },
      onPick: (f) => { s.focus = s.focus && s.focus.key === f.key && s.focus.cool === f.cool ? null : f; paint(); } });
    renderTrend(nodes.trend, { ...c, onWeek: (w) => { s.week = w; paint(); } });
    renderAssoc(nodes.assoc, c);
    if (nodes.main) renderConf(nodes.main, c);
  };
  async function load() {
    const n = ++seq;
    Object.assign(s, { loading: true, error: null, focus: null, week: null, all: false, open: new Set() });
    paint();
    try {
      const d = await fetchJson("products", productsParams(s));
      if (n !== seq) return;
      s.data = d;
      s.confs = d.conferences || [];
    } catch (e) {
      if (n !== seq) return;
      if (s.conf && e && e.kind === "error" && /\b400\b/.test(e.message || "")) { s.conf = ""; save(techQuery(s)); return load(); }
      s.data = null;
      s.error = describe(e);
    }
    s.loading = false;
    paint();
  }
  function set(patch) {
    if (!Object.keys(patch).some((k) => patch[k] !== s[k])) return;
    Object.assign(s, patch);
    save(techQuery(s));
    load();
  }
  const meta = fetchJson("meta").then((m) => { s.meta = m; }, (e) => { s.metaError = e; })
    .finally(() => { watch(!!(s.meta && s.meta.run_in_progress)); head(); });
  return { state: s, load, set, ready: Promise.all([load(), meta]) };
}
