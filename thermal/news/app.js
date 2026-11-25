// 新聞頁 (`07` D-036): one state {days} drives N-01～N-09; /news is read once per change. DOM-free so tests can drive it.
import { getJson } from "../api.js";
import { describe, newsQuery, parseNews } from "./common.js";
import { renderAssoc } from "./panels/news-assoc.js";
import { renderConf } from "./panels/news-conf.js";
import { renderChannels } from "./panels/news-channels.js";
import { renderEvidence } from "./panels/news-evidence.js";
import { renderHeader } from "./panels/news-header.js";
import { renderImmersion } from "./panels/news-immersion.js";
import { renderPfas } from "./panels/news-pfas.js";
import { renderPolicy } from "./panels/news-policy.js";
import { renderTop } from "./panels/news-top.js";

export function mountNews(nodes, { fetchJson = getJson, search = "", save = () => {} } = {}) {
  const s = { ...parseNews(search), meta: null, metaError: null, data: null, error: null, loading: true, expanded: new Set(), country: "", topic: "", pfasAll: false, evTab: "deploy", evFilter: "", countries: null };
  let seq = 0;
  const head = () => renderHeader(nodes.header, { days: s.days, meta: s.meta, metaError: s.metaError, data: s.data, onDays: (days) => set({ days }) });
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
  async function load() {
    const n = ++seq;
    Object.assign(s, { loading: true, error: null, expanded: new Set(), country: "", topic: "", pfasAll: false, evTab: "deploy", evFilter: "" });
    paint();
    try {
      const d = await fetchJson("news", { days: s.days });
      if (n !== seq) return;
      s.data = d;
    } catch (e) {
      if (n !== seq) return;
      s.data = null;
      s.error = describe(e);
    }
    s.loading = false;
    paint();
  }
  function set(patch) {
    if (!Object.keys(patch).some((k) => patch[k] !== s[k])) return;
    Object.assign(s, patch);
    save(newsQuery(s));
    load();
  }
  // N-04 國家條件：既有 /countries 的 factors，只讀一次；取不到 → countries 留 null →「條件未取得」
  const cnt = fetchJson("countries").then((d) => { s.countries = d && d.countries && typeof d.countries === "object" ? d.countries : null; }, () => { s.countries = null; }).then(paint);
  const meta = fetchJson("meta").then((m) => { s.meta = m; }, (e) => { s.metaError = e; }).finally(head);
  return { state: s, load, set, ready: Promise.all([load(), meta, cnt]) };
}
