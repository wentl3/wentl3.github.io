// 新聞頁 (`07` D-036): one state {days} drives N-01～N-09; /news is read once per change. DOM-free so tests can drive it.
import { getJson } from "../api.js";
import { describe, newsQuery, parseNews } from "./common.js";
import { renderAssoc } from "./panels/news-assoc.js";
import { renderConf } from "./panels/news-conf.js";
import { renderChannels } from "./panels/news-channels.js";
import { renderDigest } from "./panels/news-digest.js";
import { renderEvidence } from "./panels/news-evidence.js";
import { renderHeader } from "./panels/news-header.js";
import { renderImmersion } from "./panels/news-immersion.js";
import { renderPfas } from "./panels/news-pfas.js";
import { renderPolicy } from "./panels/news-policy.js";
import { renderTop } from "./panels/news-top.js";

export function mountNews(nodes, { fetchJson = getJson, search = "", save = () => {} } = {}) {
  const s = { ...parseNews(search), meta: null, metaError: null, data: null, error: null, loading: true, expanded: new Set(), country: "", topic: "", pfasAll: false, evTab: "deploy", evFilter: "", countries: null, digestScenario: "all", digest: null, digestError: null, digestLoading: true };
  let seq = 0, dSeq = 0;
  const head = () => renderHeader(nodes.header, { days: s.days, meta: s.meta, metaError: s.metaError, data: s.data, onDays: (days) => set({ days }) });
  const paintDigest = () => nodes.digest && renderDigest(nodes.digest, { scenario: s.digestScenario, data: s.digest, loading: s.digestLoading, error: s.digestError, retry: () => loadDigest(s.digestScenario), onScenario: (sc) => sc !== s.digestScenario && loadDigest(sc) });
  const paint = () => {
    const c = { data: s.data, loading: s.loading, error: s.error, retry: load, days: s.days };
    head();
    renderChannels(nodes.channels, { ...c, expanded: s.expanded, onExpand: (id) => { s.expanded.add(id); paint(); } });
    renderImmersion(nodes.immersion, c);
    const exp = { expanded: s.expanded, onExpand: (id) => { s.expanded.add(id); paint(); } };
    if (nodes.top) renderTop(nodes.top, { ...c, ...exp });
    if (nodes.conf) renderConf(nodes.conf, { ...c, ...exp });
    renderPolicy(nodes.policy, { ...c, country: s.country, topic: s.topic, countries: s.countries, onCountry: (v) => { s.country = v; paint(); }, onTopic: (v) => { s.topic = v; paint(); } });
    renderAssoc(nodes.assoc, c);
    renderPfas(nodes.pfas, { ...c, all: s.pfasAll, onAll: () => { s.pfasAll = true; paint(); } });
    if (nodes.evidence) renderEvidence(nodes.evidence, { ...c, tab: s.evTab, filter: s.evFilter, onTab: (v) => { s.evTab = v; paint(); }, onFilter: (v) => { s.evFilter = v; paint(); } });
  };
  async function fetchInto(p, q, dk, ek, lk, draw, sq) {
    const n = sq();
    s[lk] = true; s[ek] = null; draw();
    try { const d = await fetchJson(p, q); if (n !== sq(1)) return; s[dk] = d; }
    catch (e) { if (n !== sq(1)) return; s[dk] = null; s[ek] = describe(e); }
    s[lk] = false; draw();
  }
  const load = () => (Object.assign(s, { expanded: new Set(), country: "", topic: "", pfasAll: false, evTab: "deploy", evFilter: "" }), fetchInto("news", { days: s.days }, "data", "error", "loading", paint, (c) => (c ? seq : ++seq)));
  const loadDigest = (sc = s.digestScenario) => (s.digestScenario = sc, fetchInto("digest", { scenario: sc }, "digest", "digestError", "digestLoading", paintDigest, (c) => (c ? dSeq : ++dSeq)));
  function set(patch) {
    if (!Object.keys(patch).some((k) => patch[k] !== s[k])) return;
    Object.assign(s, patch);
    save(newsQuery(s));
    load();
  }
  // N-04 國家條件：既有 /countries 的 factors，只讀一次；取不到 → countries 留 null →「條件未取得」
  const cnt = fetchJson("countries").then((d) => { s.countries = d && d.countries && typeof d.countries === "object" ? d.countries : null; }, () => { s.countries = null; }).then(paint);
  const meta = fetchJson("meta").then((m) => { s.meta = m; }, (e) => { s.metaError = e; }).finally(head);
  const dig = nodes.digest ? loadDigest("all") : Promise.resolve();
  return { state: s, load, set, ready: Promise.all([load(), meta, cnt, dig]) };
}
