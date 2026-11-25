// Snapshot-mode replacement for dashboard/api.js (WO-84): same getJson(path, params) and ApiError, data from ./data/*.json.
// Lists are {r: records, f: facets}; the exporter computed each facet with the pipeline's own predicates, so filtering here
// is only membership (c country, v vendor, s scenario, d doc_type, o focus, g doc_group, k constraint, i signal, l library, t stale).
export class ApiError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; } // kind: offline | error
}
const cache = new Map();
const load = (p) => {
  if (!cache.has(p)) {
    const t = fetch(`./data/${p}.json`).then(
      (r) => { if (!r.ok) throw new ApiError("error", `快照資料 ${p} 回應 ${r.status}`); return r.json().catch(() => { throw new ApiError("error", `快照資料 ${p} 格式錯誤`); }); },
      () => { throw new ApiError("offline", `快照資料 ${p} 讀取失敗`); });
    t.catch(() => cache.delete(p)); // a failed read is retried on the next call, never cached
    cache.set(p, t);
  }
  return cache.get(p);
};
const SC = ["", "S-HEAT", "S-EFF", "S-EDGE", "S-MIL"], CELLS = ["news", "vendors", "library", "cases"], COOL = ["Air", "DLC", "1PIC", "2PIC"];
const err = (code) => new ApiError("error", `Pipeline API 回應 ${code}`);
const need = (P, ok) => { const k = Object.keys(P).find((x) => !ok.includes(x)); if (k) throw new ApiError("error", `快照版不支援參數 ${k}`); };
const IM = { country: "c", vendor: "v", scenario: "s", doc_type: "d" }, CM = { country: "c", vendor: "v", scenario: "s" };
const EM = { ...CM, doc_group: "g", constraint: "k", signal: "i", focus: "o" };
const pick = (F, P, M) => F.flatMap((f, i) => (Object.keys(M).every((k) => !P[k] || f[M[k]].includes(P[k])) ? [i] : []));
const lc = (P) => ({ ...P, vendor: (P.vendor || "").toLowerCase() }); // events match vendors case-insensitively
const evIdx = (d, P, ie = (P.is_event || "").toLowerCase()) => pick(d.f, lc(P), EM).filter((i) => (ie === "true" || ie === "false" ? d.r[i].is_event === (ie === "true")
  : ie === "not_false" ? !(d.r[i].doc_group === "deploy" && d.r[i].is_event === false) : true));
const lim = (P, d) => (P.limit ? +P.limit : d);

async function items(P) {
  need(P, [...Object.keys(IM), "focus", "limit"]);
  const { r, f } = await load("items"), n = lim(P, 50);
  let i = pick(f, P, IM).slice(0, P.focus ? 1e5 : n).filter((x) => !f[x].l && !f[x].t); // the view cuts first, then drops library／stale
  if (P.focus) i = i.filter((x) => f[x].o[0] === P.focus).slice(0, n);
  return { count: i.length, items: i.map((x) => r[x]) };
}
async function events(P) {
  need(P, [...Object.keys(EM), "is_event", "include_stale"]);
  const d = await load(P.include_stale === "1" ? "events_stale" : "events"), i = evIdx(d, P);
  return { events: i.map((x) => d.r[x]), total: i.length, accepted: d.accepted };
}
async function listOf(name, key, P, dflt) {
  need(P, [...Object.keys(IM), "limit"]);
  const { r, f } = await load(name), i = pick(f, P, IM).slice(0, lim(P, dflt));
  return { count: i.length, [key]: i.map((x) => r[x]) };
}
async function cases(P) {
  need(P, Object.keys(CM));
  const { r, f } = await load("cases"), i = pick(f, P, CM);
  return { count: i.length, cases: i.map((x) => r[x]) };
}

async function coverage(P) { // pipeline/coverage.py, over the same lists
  need(P, ["vendor", "country", "scenario", "focus"]);
  const [it, lb, cs, ev, st, cv, rg] = await Promise.all(["items", "library", "cases", "events", "events_stale", "coverage", "vendors"].map(load));
  const cnt = (vendor, country, scenario, cell, stale, focus) => {
    const Q = { vendor, country, scenario };
    if (cell === "news") return evIdx(stale ? st : ev, { ...Q, focus }).length;
    if (cell === "vendors") return pick(it.f, Q, IM).filter((x) => !it.f[x].l && (stale || !it.f[x].t)).length;
    if (cell === "library") return pick(lb.f, Q, IM).length;
    const c = pick(cs.f, Q, CM).map((x) => cs.r[x]), pin = new Set(c.map((x) => x.item_id || x.item.id));
    return c.length + evIdx(st, { ...Q, doc_group: "deploy", is_event: "not_false" }).filter((x) => !pin.has(st.r[x].sources[0]?.item_id)).length;
  };
  const why = (v, c, s, cell, fo) => {
    let n = cnt(v, c, s, cell, 0, fo);
    if (n >= 1) return ["has_data", n];
    if ((n = cnt(v, c, s, cell, 1, fo)) >= 1) return ["stale_hidden", n];
    if (s && s !== "untagged" && (n = cnt(v, c, "untagged", cell, 0, fo)) >= 1) return ["untagged", n];
    if (v) return cv.q[v] ? ["queried_none_kept", cv.q[v]] : ["not_queried", null];
    return [cell === "cases" ? "no_cases" : "no_accepted", null];
  };
  const cell = (v, c, s, k, fo) => {
    const [code, d] = why(v, c, s, k, fo);
    const zh = { stale_hidden: `有 ${d} 筆，但原頁早於 ${cv.stale_days} 天（D-019）`, untagged: `有 ${d} 筆，但未標場景`, not_queried: "尚未查詢",
      queried_none_kept: d && `查過（最後 ${d.last}，找到 ${d.found} 筆），沒有收錄`, no_cases: "尚無人工案例或部署事件", no_accepted: "尚無已收錄的情報" };
    return { n: code === "has_data" ? d : 0, code, zh: zh[code] || "" };
  };
  const { vendor: V, country: C, scenario: S, focus: F } = P;
  return {
    cells: Object.fromEntries(CELLS.map((k) => [k, cell(V, C, S, k, F)])),
    scenario_counts: Object.fromEntries([undefined, ...SC.slice(1)].map((s) => [s || "all", cnt(V, C, s, "vendors")])),
    vendor_counts: Object.fromEntries(rg.vendors.map((v) => [v.name, cell(v.name, C, S, "vendors")])),
    untagged: Object.fromEntries(CELLS.map((k) => [k, cnt(V, C, "untagged", k, 0, F)])),
  };
}

async function countries(P) {
  need(P, ["scenario", "vendor"]);
  if (!SC.includes(P.scenario || "")) throw new ApiError("error", `快照版不支援場景 ${P.scenario}`);
  const [fa, ix] = await Promise.all([load("countries/factors"), load("countries/index")]);
  const n = ix[P.vendor || ""], dyn = n === undefined ? {} : (await load(`countries/s${n}`))[P.scenario || ""];
  const none = { reg: 0, deploy: 0, rumour: 0, reg_structure: {} };
  return { countries: Object.fromEntries([...new Set([...Object.keys(fa), ...Object.keys(dyn)])].sort().map((i) => [i,
    { factors: fa[i] || {}, counts: dyn[i]?.counts || {}, constraints: dyn[i]?.constraints || {}, events: dyn[i]?.events || none }])) };
}
async function byScenario(file, P) { // hubs／country: one file, keyed by scenario
  need(P, ["scenario"]);
  const d = (await load(file))[P.scenario || ""];
  if (d === undefined) throw new ApiError("error", `快照版不支援場景 ${P.scenario}`);
  return d;
}
async function products(P) {
  need(P, ["days", "cooling", "conf"]);
  if (P.days && !["30", "90", "365"].includes(P.days)) throw err(400);
  if (P.cooling && !COOL.includes(P.cooling)) throw err(400);
  const cool = P.cooling || "all";
  if (!P.conf) return load(`products/d_${P.days || 90}_${cool}`);
  if (!(await load("products/d_90_all")).conferences.some((c) => c.id === P.conf)) throw err(400);
  return load(`products/c_${P.conf}_${cool}`);
}
async function news(P) {
  need(P, ["days"]);
  if (P.days && !["7", "30"].includes(P.days)) throw err(400);
  return load(`news/d_${P.days || 7}`);
}

export async function getJson(path, params = {}) {
  const P = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") P[k] = String(v);
  let out;
  if (["meta", "vendors", "headlines", "digest", "strategy"].includes(path)) out = await load(path);
  else if (path === "items") out = await items(P);
  else if (path === "events") out = await events(P);
  else if (path === "library") out = await listOf("library", "items", P, 100);
  else if (path === "cases") out = await cases(P);
  else if (path === "coverage") out = await coverage(P);
  else if (path === "countries") out = await countries(P);
  else if (path === "hubs") out = { hubs: await byScenario("hubs", P) };
  else if (path === "products") out = await products(P);
  else if (path === "news") out = await news(P);
  else if (/^countries\//.test(path)) {
    if (!/^countries\/[A-Z]{2}$/.test(path)) throw err(400);
    out = await byScenario(`country/${path.slice(10)}`, P);
  } else throw err(404);
  return structuredClone(out); // callers mutate what they get (app.js loadBrief); never hand out the cached object
}
