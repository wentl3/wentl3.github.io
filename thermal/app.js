// Boot: one selection drives the map, 國家條件 and the four cells (`07` v0.7 §1)
import { getJson } from "./api.js";
import { GLOBAL_ROWS, SCENARIO_RULES } from "./config.js";
import { LAYER_BY_ID, layerCuts, ruleStats } from "./lib/layers.js";
import { numericToAlpha2 } from "./lib/geo.js";
import { createMap } from "./map.js";
import { renderAnalysis } from "./panels/analysis.js";
import { renderCases } from "./panels/cases.js";
import { renderConditions } from "./panels/conditions.js";
import { renderFooter } from "./panels/footer.js";
import { renderLibrary } from "./panels/library.js";
import { renderLegend, renderMapControls } from "./panels/map.js";
import { renderNews } from "./panels/news.js";
import { renderTopbar } from "./panels/topbar.js";
import { renderVendors } from "./panels/vendors.js";
import { getSelection, onSelection, setSelection, shareUrl } from "./selection.js";

const $ = (id) => document.getElementById(id);
const CELLS = ["news", "vendors", "library", "cases"];
const ui = { newsView: "events", newsType: "", newsGroup: "", newsSignal: "", libQuery: "", expanded: {}, overlays: { dots: true, hubs: true, cons: true, pins: true },
  ruleValues: {}, picked: null, evidence: null, axes: { x: "hdd", y: "renew" } };
const data = { meta: null, metaError: null, registry: [], countries: {}, countriesError: null, hubs: [], brief: null, briefError: null,
  global: null, cells: {}, cuts4: {}, cuts3: {}, lastStats: null, events: [], cov: null, covError: null };
let map = null;
const seq = { evi: 0, cov: 0, unt: 0, countries: 0, brief: 0, global: 0, hubs: 0, events: 0, news: 0, vendors: 0, library: 0, cases: 0 };
const pick = (patch) => setSelection(patch);
const TITLES = { news: "新聞", vendors: "業者", library: "參考庫", cases: "案例" };
ui.untagged = Object.fromEntries(CELLS.map((c) => [c, { open: false, data: null }])); // B3

function currentRule() {
  const sel = getSelection();
  const base = SCENARIO_RULES[sel.scenario] || [];
  const vals = ui.ruleValues[sel.scenario] || {};
  return base.map((c, i) => (i in vals && Number.isFinite(vals[i]) ? { ...c, value: vals[i] } : c));
}

function hubRow(id) { return data.hubs.find((h) => h.id === id) || null; }

function topbar() {
  const sel = getSelection();
  renderTopbar($("topbar"), { sel, meta: data.meta, metaError: data.metaError, hubName: hubRow(sel.hub)?.name_zh,
    counts: data.cov?.scenario_counts, onScenario: (scenario) => setSelection({ scenario }),
    onClear: (keys) => setSelection(Object.fromEntries([...keys, ...(keys.includes("country") ? ["hub"] : [])].map((k) => [k, ""]))),
    onCopy: async () => { try { await navigator.clipboard.writeText(shareUrl()); } catch { /* insecure context */ } } });
}

function footer() {
  const ds = new Map();
  for (const row of Object.values(data.brief?.factors || {})) ds.set(row.dataset, row);
  for (const c of Object.values(data.countries)) for (const f of Object.values(c.factors || {})) if (!ds.has(f.dataset)) ds.set(f.dataset, f);
  renderFooter($("footer"), { meta: data.meta, datasets: [...ds.values()] });
}

function paintMap() {
  const sel = getSelection();
  const rule = currentRule();
  const stats = ruleStats(data.countries, rule);
  renderMapControls($("map-ctl"), { sel, rule, stats, overlays: ui.overlays, cuts3: data.cuts3,
    onMode: (mode) => setSelection({ mode, x: getSelection().x === mode ? "" : getSelection().x }),
    onX: (x) => setSelection({ x }), onFilt: (on) => setSelection({ filt: on ? "1" : "" }),
    onRuleValue: (i, v) => { (ui.ruleValues[sel.scenario] ||= {})[i] = v; paintMap(); },
    onOverlay: (k) => { ui.overlays[k] = !ui.overlays[k]; paintMap(); } });
  renderLegend($("legend"), { sel, cuts3: data.cuts3, overlays: ui.overlays, pins: data.lastStats?.pins });
  $("map-state").textContent = data.countriesError ? "無法連線到 Pipeline API：地圖只有底圖" : "";
  if (!map) return null;
  data.lastStats = map.update(data.countries, sel, { cuts4: data.cuts4, cuts3: data.cuts3, rule, overlays: ui.overlays, hubs: data.hubs, events: data.events });
  renderLegend($("legend"), { sel, cuts3: data.cuts3, overlays: ui.overlays, pins: data.lastStats.pins });
  return data.lastStats;
}

async function loadCountries() {
  const n = ++seq.countries;
  const sel = getSelection();
  try {
    const d = await getJson("countries", { scenario: sel.scenario, vendor: sel.vendor });
    if (n !== seq.countries) return;
    data.countries = d.countries || {};
    data.countriesError = null;
    data.cuts4 = layerCuts(data.countries, 4);
    data.cuts3 = layerCuts(data.countries, 3);
  } catch (e) {
    if (n !== seq.countries) return;
    data.countriesError = e;
  }
  paintMap();
  conditions();
  footer();
  analysis();
}

function analysis() { // E-12 (F4): scatter over the same scenario／vendor-filtered /countries rows as the map
  if (data.countriesError) { $("panel-analysis").textContent = "無法連線到 Pipeline API：無法做關聯分析"; return; }
  renderAnalysis($("panel-analysis"), { countries: data.countries, x: ui.axes.x, y: ui.axes.y,
    onAxis: (k, v) => { ui.axes[k] = v; analysis(); }, onPick: (country) => setSelection({ country, hub: "" }), onRow: openEvidence });
}

async function loadHubs() {
  const n = ++seq.hubs;
  try {
    const d = await getJson("hubs", { scenario: getSelection().scenario });
    if (n !== seq.hubs) return;
    data.hubs = d.hubs || [];
  } catch { if (n === seq.hubs) data.hubs = []; }
  paintMap();
  conditions();
  topbar();
}

async function loadEvents() { // E-11 pins: every event for the scenario／vendor (country does not narrow the map)
  const n = ++seq.events;
  const sel = getSelection();
  try {
    const d = await getJson("events", { scenario: sel.scenario, vendor: sel.vendor });
    if (n !== seq.events) return;
    data.events = d.events || [];
  } catch { if (n === seq.events) data.events = []; }
  paintMap();
}

async function openEvidence(country, layer = getSelection().mode) {
  const n = ++seq.evi, sel = getSelection(), l = LAYER_BY_ID[layer] || LAYER_BY_ID.policy;
  ui.evidence = { country, layer, loading: true };
  setSelection({ country, hub: "" });
  conditions();
  try {
    const d = await getJson("events", { country, scenario: sel.scenario, vendor: sel.vendor, doc_group: l.events || "reg", is_event: "not_false" });
    if (n === seq.evi && ui.evidence) ui.evidence = { country, layer, events: d.events || [] };
  } catch (e) { if (n === seq.evi && ui.evidence) ui.evidence = { country, layer, error: e }; }
  conditions();
}

function pickEvent(ev) {
  ui.picked = ev;
  if (getSelection().country === ev.country && !getSelection().hub) conditions();
  else setSelection({ country: ev.country, hub: "" });
}

async function loadGlobal() {
  const n = ++seq.global;
  const sel = getSelection();
  data.global = { loading: true };
  conditions();
  try {
    const d = await getJson("events", { scenario: sel.scenario, vendor: sel.vendor, doc_group: "reg" });
    if (n !== seq.global) return;
    data.global = { events: d.events || [], loading: false };
  } catch (e) {
    if (n !== seq.global) return;
    data.global = { error: e };
  }
  conditions();
}

function conditions() {
  const sel = getSelection();
  renderConditions($("conditions"), { sel, countryList: Object.keys(data.countries), brief: data.brief,
    loading: data.brief === null, error: data.briefError, retry: loadBrief, global: data.global, globalRetry: loadGlobal,
    hub: hubRow(sel.hub), picked: ui.picked, evidence: ui.evidence, onEvidenceBack: () => { ui.evidence = null; conditions(); }, onPick: pick, onCountry: (country) => setSelection({ country, hub: "" }),
    onBack: () => { ui.picked = null; setSelection({ country: "", hub: "" }); } });
}

async function loadBrief() {
  const n = ++seq.brief;
  const sel = getSelection();
  data.brief = null;
  data.briefError = null;
  conditions();
  if (!sel.country) return;
  try {
    const [d, ev] = await Promise.all([getJson(`countries/${sel.country}`, { scenario: sel.scenario }),
      getJson("events", { country: sel.country, scenario: sel.scenario, vendor: sel.vendor, doc_group: "reg" })]);
    if (n !== seq.brief) return;
    if (sel.vendor) d.items = (d.items || []).filter((it) => (it.extraction?.vendors || []).includes(sel.vendor));
    d.events = ev.events || [];
    data.brief = d;
  } catch (e) {
    if (n !== seq.brief) return;
    data.briefError = e;
  }
  conditions();
  footer();
}

const focusParam = (sel) => (sel.focus === "all" ? "" : sel.focus); // D-018: "all" = no filter

const LOADERS = {
  news: (sel) => (ui.newsView === "events"
    ? getJson("events", { country: sel.country, vendor: sel.vendor, scenario: sel.scenario, doc_group: ui.newsGroup, signal: ui.newsSignal, focus: focusParam(sel) })
    : ui.newsView === "items"
      ? getJson("items", { country: sel.country, vendor: sel.vendor, scenario: sel.scenario, doc_type: ui.newsType, focus: focusParam(sel), limit: 60 })
      : getJson("headlines", { country: sel.country, limit: 100 })),
  vendors: (sel) => getJson("items", { vendor: sel.vendor, country: sel.country, scenario: sel.scenario, limit: 60 }),
  library: (sel) => getJson("library", { country: sel.country, vendor: sel.vendor, scenario: sel.scenario }),
  cases: async (sel) => { // H-013 L1: manual cases pinned + deploy events
    const q = { country: sel.country, vendor: sel.vendor, scenario: sel.scenario };
    const [c, e] = await Promise.all([getJson("cases", q), getJson("events", { ...q, doc_group: "deploy", include_stale: "1" })]);
    return { cases: c.cases || [], events: e.events || [] };
  },
};

function renderCell(name) {
  const sel = getSelection();
  const st = data.cells[name] || { loading: true };
  const common = { sel, data: st.data, loading: st.loading, error: st.error, retry: () => loadCell(name), onPick: pick,
    expanded: !!ui.expanded[name], onToggle: () => { ui.expanded[name] = !ui.expanded[name]; renderCell(name); },
    reason: data.cov?.cells?.[name]?.n === 0 ? data.cov.cells[name].zh : "",
    untagged: { n: data.cov?.untagged?.[name] || 0, ...ui.untagged[name], toggle: () => toggleUntagged(name) } };
  const node = $(`cell-${name}`);
  if (name === "news") renderNews(node, { ...common, view: ui.newsView, docType: ui.newsType, group: ui.newsGroup, signal: ui.newsSignal, focus: sel.focus, onFocus: (focus) => setSelection({ focus }),
    onView: (v) => { ui.newsView = v; loadCell("news"); }, onType: (t) => { ui.newsType = t; loadCell("news"); },
    onGroup: (g) => { ui.newsGroup = g; loadCell("news"); }, onSignal: (v) => { ui.newsSignal = v; loadCell("news"); } });
  else if (name === "vendors") renderVendors(node, { ...common, registry: data.registry, vendor_counts: data.cov?.vendor_counts, onVendor: (vendor) => setSelection({ vendor }) });
  else if (name === "library") renderLibrary(node, { ...common, query: ui.libQuery, onQuery: (q) => { ui.libQuery = q; renderCell("library"); } });
  else renderCases(node, common);
}

async function loadCell(name) {
  const n = ++seq[name];
  data.cells[name] = { loading: true };
  if (ui.untagged[name].open) { ui.untagged[name].data = null; loadUntagged(name); }
  renderCell(name);
  try {
    const d = await LOADERS[name](getSelection());
    if (n !== seq[name]) return;
    data.cells[name] = { loading: false, data: d };
  } catch (e) {
    if (n !== seq[name]) return;
    data.cells[name] = { loading: false, error: e };
  }
  renderCell(name);
}

const loadCells = () => { for (const c of CELLS) ui.untagged[c] = { open: false, data: null }; return Promise.all(CELLS.map(loadCell)); };

async function loadUntagged(name) { // R-COV-4
  const n = ++seq.unt;
  try {
    const d = await LOADERS[name]({ ...getSelection(), scenario: "untagged" });
    if (ui.untagged[name].open && n === seq.unt) { ui.untagged[name].data = d; renderCell(name); }
  } catch { ui.untagged[name].open = false; renderCell(name); }
}

function toggleUntagged(name) {
  const u = ui.untagged[name];
  u.open = !u.open;
  if (u.open && !u.data) loadUntagged(name);
  renderCell(name);
}

async function loadCoverage() { // D-020
  const n = ++seq.cov;
  const sel = getSelection();
  try {
    const d = await getJson("coverage", { vendor: sel.vendor, country: sel.country, scenario: sel.scenario, focus: focusParam(sel) });
    if (n !== seq.cov) return;
    data.cov = d;
    data.covError = null;
  } catch (e) {
    if (n !== seq.cov) return;
    data.cov = null;
    data.covError = e;
  }
  topbar();
  for (const c of CELLS) {
    const cnt = data.cov ? `（${data.cov.cells[c].n}）` : data.covError ? "（未取得）" : "";
    $(`cell-${c}`).parentNode.querySelector("h2").textContent = TITLES[c] + cnt;
    renderCell(c);
  }
}

onSelection((sel, changed) => {
  topbar();
  const has = (...k) => k.some((x) => changed.includes(x));
  if (ui.picked && ui.picked.country !== sel.country) ui.picked = null;
  if (ui.evidence && (ui.evidence.country !== sel.country || has("scenario", "vendor"))) ui.evidence = null;
  if (has("scenario", "vendor")) { loadCountries(); loadGlobal(); loadEvents(); }
  if (has("scenario")) loadHubs();
  if (has("mode", "x", "filt", "country", "hub") && !has("scenario", "vendor")) paintMap();
  if (has("country", "scenario", "vendor")) loadBrief();
  else if (has("hub")) conditions();
  if (has("country", "scenario", "vendor")) { loadCoverage(); loadCells(); }
  else if (has("focus")) { loadCell("news"); loadCoverage(); }
});

async function boot() {
  $("zoom-in").addEventListener("click", () => map && map.zoomIn());
  $("zoom-out").addEventListener("click", () => map && map.zoomOut());
  $("zoom-reset").addEventListener("click", () => map && map.reset());
  topbar();
  conditions();
  for (const c of CELLS) renderCell(c);
  footer();
  paintMap();
  const [topo, iso] = await Promise.all([fetch("vendor/countries-110m.json").then((r) => r.json()), fetch("vendor/iso-numeric.json").then((r) => r.json())]);
  map = createMap($("map"), topo, numericToAlpha2(iso), (country) => openEvidence(country),
    (id) => { const h = hubRow(id); if (h) setSelection({ hub: id, country: h.country }); }, pickEvent);
  getJson("meta").then((m) => { data.meta = m; }, (e) => { data.metaError = e; }).finally(() => { topbar(); footer(); });
  getJson("vendors").then((v) => { data.registry = v.vendors || []; renderCell("vendors"); }, () => {});
  await Promise.all([loadCountries(), loadHubs(), loadEvents(), loadGlobal(), loadBrief(), loadCells(), loadCoverage()]);
}

boot().then(() => { if (location.hash.startsWith("#smoke")) import("./smoke.js").then((m) => m.runSmoke({ getSelection, setSelection, paintMap, data, GLOBAL_ROWS, matrix: location.hash === "#smoke=matrix" })); });
