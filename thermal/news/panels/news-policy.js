// N-04 國家政策變化表 (`07` D-036／D-037): 國家下拉（policy_changes＋policy_headlines 有列的國家）＋議題篩選；原表（證據層）＋「標題級（未抽取）」補充列；選定國家時一行條件（/countries factors）
import { fill, el, link } from "../../lib/dom.js";
import { countryZh } from "../../lib/format.js";
import { waterBand } from "../../lib/counts.js";
import { showError, showLoading } from "../../lib/states.js";
import { TOPICS, TOPIC_ZH, arr, itemDate, text } from "../common.js";

const zh = (c) => (c === null || c === undefined || c === "" ? "未判定" : countryZh(c) || text(c));
/** 同一篇（url；無 url 用 title＋date）合併成一列，members 保原順序；國家欄列出全部國家（頓號）、無國家 → 未判定。 */
export function mergeRows(list) {
  const idx = new Map(), out = [];
  for (const r of list) {
    const k = r.url ? `u|${r.url}` : `t|${text(r.title)}|${text(r.date).slice(0, 10)}`;
    if (!idx.has(k)) { idx.set(k, out.length); out.push({ ...r, members: [r] }); } else out[idx.get(k)].members.push(r);
  }
  for (const m of out) {
    const cs = [...new Set(m.members.map((x) => x.country).filter((c) => c !== null && c !== undefined && c !== ""))];
    m.countryText = cs.length ? cs.map(zh).join("、") : "未判定";
    m.topics = [...new Set(m.members.flatMap((x) => arr(x.topics)))];
    m.official = m.members.some((x) => x.official);
  }
  return out;
}
const topicsOf = (r) => arr(r.topics).map((t) => TOPIC_ZH[t] || t).join("、");
const head = (hs) => el("thead", {}, el("tr", {}, ...hs.map((h) => el("th", { text: h }))));
const src = (r) => (r.official ? "官方" : "非官方來源");

/** 一行條件（題庫 Q06）：水壓力｜再生能源占比｜免費冷卻時數（W32）；countries 取不到 → 「條件未取得」。 */
export function conditionLine(countries, iso) {
  const f = countries && typeof countries === "object" && countries[iso] && countries[iso].factors;
  if (!f || typeof f !== "object") return "條件未取得";
  const v = (k) => (f[k] && Number.isFinite(f[k].value) ? f[k].value : null);
  const w = f.water_stress ? waterBand(f.water_stress.band) : null, ws = v("water_stress");
  const water = w && w.cls ? w.zh : ws !== null ? `水壓 ${ws}` : "未取得", re = v("energy_renewable_share"), fc = v("climate_freecool_w32_h");
  return `水壓力：${water}｜再生能源占比：${re !== null ? `${re} %` : "未取得"}｜免費冷卻時數（W32）：${fc !== null ? `${fc} h／年` : "未取得"}`;
}

export function renderPolicy(node, { data, loading, error, retry, country, topic, countries, onCountry, onTopic }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "國家政策變化");
  const rows = arr(data.policy_changes), hasHl = Array.isArray(data.policy_headlines), hls = arr(data.policy_headlines);
  const counts = new Map();
  for (const r of [...rows, ...hls]) if (r.country !== null && r.country !== undefined && r.country !== "") counts.set(r.country, (counts.get(r.country) || 0) + 1);
  const cur = counts.has(country) ? country : "", tp = TOPICS.includes(topic) ? topic : "";
  const sel = el("select", { "aria-label": "國家", "data-ctl": "country", onchange: (e) => onCountry(e.target.value) },
    el("option", { value: "", text: `全部（${rows.length + hls.length}）`, selected: cur === "" }),
    ...[...counts].map(([c, n]) => el("option", { value: text(c), text: `${zh(c)}（${n}）`, selected: cur === c })));
  sel.value = cur;
  const pass = (r) => (!cur || r.country === cur) && (!tp || arr(r.topics).includes(tp));
  const mpass = (m) => m.members.some(pass);
  const shown = mergeRows(rows).filter(mpass), hShown = mergeRows(hls).filter(mpass);
  box.append(...[el("div", { class: "controls" },
    el("div", { class: "ctl" }, el("span", { class: "ctl-label", text: "國家" }), sel),
    el("div", { class: "ctl", "data-ctl": "topic" }, el("span", { class: "ctl-label", text: "議題" }),
      el("div", { class: "seg", role: "group", "aria-label": "議題" },
        ...TOPICS.map((t) => el("button", { type: "button", "aria-pressed": String(t === tp), "data-value": t, onclick: () => onTopic(t), text: t ? TOPIC_ZH[t] : "全部" }))))),
  cur ? el("p", { class: "note cond", text: conditionLine(countries, cur) }) : null,
  shown.length ? el("div", { class: "tbl-wrap" }, el("table", {}, head(["國家", "議題", "日期", "標題", "原文", "來源類別"]),
    el("tbody", {}, ...shown.map((r) => el("tr", { class: "prow" }, el("td", { text: r.countryText }), el("td", { text: topicsOf(r) }),
      el("td", { class: "mono", text: text(r.date).slice(0, 10) || "日期不明" }), el("td", { text: text(r.title) }), el("td", {}, link(r.url, "原文")), el("td", { text: src(r) }))))))
    : el("p", { class: "state empty", text: "近 90 天未查到變更（未查到≠沒有）" })].filter(Boolean));
  if (!hasHl) return;
  box.append(el("h3", { text: "標題級（未抽取）" }),
    hShown.length ? el("div", { class: "tbl-wrap" }, el("table", {}, head(["國家", "議題", "日期", "原始標題", "原文", "來源類別", "層級"]),
      el("tbody", {}, ...hShown.map((r) => el("tr", { class: "hrow" }, el("td", { text: r.countryText }), el("td", { text: topicsOf(r) }),
        el("td", { class: "mono", text: itemDate(r) }), el("td", { text: text(r.title) }), el("td", {}, link(r.url, "原文")), el("td", { text: src(r) }),
        el("td", {}, el("span", { class: "tag", text: "標題級（未抽取）" })))))))
      : el("p", { class: "state empty", text: "近 90 天無標題級（未抽取）政策標題" }));
}
