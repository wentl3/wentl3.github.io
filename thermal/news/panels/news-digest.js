// N-10 本週各來源重點濃縮 (`07` D-039)
import { fill, el, link } from "../../lib/dom.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";
import { arr, text } from "../common.js";

export const DIGEST_SCENARIOS = [["all", "全部"], ["S-HEAT", "熱回收"], ["S-EFF", "節能高水溫"], ["S-EDGE", "邊緣戶外"], ["S-MIL", "軍事國防"]];

export function renderDigest(node, { scenario = "all", data, loading, error, retry, onScenario = () => {} }) {
  const cur = DIGEST_SCENARIOS.some(([v]) => v === scenario) ? scenario : "all", body = el("div");
  fill(node, el("div", { class: "list" },
    el("div", { class: "ctl" }, el("span", { class: "ctl-label", text: "場景" }),
      el("div", { class: "seg", role: "group", "aria-label": "濃縮場景" },
        ...DIGEST_SCENARIOS.map(([v, zh]) => el("button", { type: "button", "aria-pressed": String(v === cur), "data-value": v, onclick: () => onScenario(v), text: zh })))),
    body));
  if (error) return showError(body, error, retry);
  if (loading || !data) return showLoading(body, "本週濃縮");
  const g = data.digest;
  if (!g) return showEmpty(body, text(data.reason) || "尚未產生");
  if (g.status === "failed") return showEmpty(body, `摘要產生失敗：${text(g.reason) || "原因未提供"}`);
  const sents = arr(g.sentences);
  if (!sents.length) return showEmpty(body, "本週無已整理情報");
  const srcs = data.sources || {}, nums = new Map();
  const ref = (id) => (srcs[id] && srcs[id].url ? link(srcs[id].url, text(srcs[id].domain || srcs[id].title) || "原文")
    : el("span", { class: "tag muted", text: `[${nums.has(id) ? nums.get(id) : nums.set(id, nums.size + 1).get(id)}]` }));
  fill(body, el("p", { class: "note", text: `${text(g.day) ? `統計截至 ${text(g.day)}｜` : ""}AI 彙整・附原文連結（只隨場景）` }),
    el("ol", { class: "nlist" }, ...sents.map((s) => el("li", { class: "nrow" }, el("span", { text: text(s.text) }), ...arr(s.ids).map(ref)))));
}
