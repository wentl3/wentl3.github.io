import { getJson } from "../api.js";
import { el, fill } from "./dom.js";
import { eventCard } from "./eventcard.js";
import { showError, showLoading } from "./states.js";
const memo = new Map();
const note = (t) => el("p", { class: "state empty", text: t });
const tag = (cls, text) => el("span", { class: `tag ${cls}`, text });
export function aiBox(load = getJson, title, path, p, build) {
  const body = el("div"), slot = el("div"), nums = new Map();
  const ref = (id) => {
    if (id.startsWith("factor:")) return tag("muted", `構面：${id.slice(7)}`);
    if (!nums.has(id)) nums.set(id, nums.size + 1);
    return el("button", { type: "button", class: "chip", text: `[${nums.get(id)}]`, onclick: () => {
      load("events", { country: p.country, scenario: p.scenario === "all" ? "" : p.scenario }).then((d) => {
        const ev = d.events?.find((e) => e.sources?.some((x) => x.item_id === id));
        fill(slot, ev ? eventCard(ev, { compact: true }) : note("找不到對應事件卡"));
      }).catch((e) => showError(slot, e));
    } });
  };
  const k = path + JSON.stringify(p);
  if (!memo.has(k)) memo.set(k, load(path, p));
  showLoading(body, "");
  memo.get(k).then((d) => fill(body, build(d, ref))).catch((e) => { memo.delete(k); showError(body, e); });
  return el("section", { class: "note" }, el("h3", { text: title }), body, slot);
}
const guard = (x, d, w, ok) => (!x ? note(d.reason || "尚未產生") : x.status === "failed" ? note(`${w}產生失敗：${x.reason || "原因未提供"}`) : ok(x));
export const digestView = (d, ref) => guard(d.digest, d, "摘要", (g) => (g.sentences?.length
  ? el("div", {}, ...g.sentences.map((s) => el("p", {}, `${s.text} `, ...(s.ids || []).map(ref)))) : note("本週無已整理情報")));
const DIM = { policy: "政策", climate: "氣候", water: "水", energy: "能源", competition: "競爭", timing: "時程" };
const DIR = { favorable: "有利", unfavorable: "不利" }, CONF = { high: "高", mid: "中", low: "低" };
export const strategyView = (d, ref) => guard(d.strategy, d, "策略", (s) => el("div", {}, s.needs_review ? tag("warn", "待人工確認") : null,
  el("dl", { class: "kv" }, ...Object.keys(DIM).flatMap((k) => { const x = s.dimensions?.[k] || {}; return [el("dt", { text: DIM[k] }),
    el("dd", {}, tag("", (DIR[x.direction] || "不明") + (x.confidence ? `・信心${CONF[x.confidence]}` : "")),
      ` ${x.reason || ""} `, ...(x.evidence || []).map(ref))]; })),
  el("ul", { class: "fit" }, ...(s.impacts || []).map((i) => el("li", { text: i.text })))));
