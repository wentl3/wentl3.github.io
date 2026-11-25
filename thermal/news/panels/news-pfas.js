// N-06 PFAS 與兩相冷卻液 (`07` D-036): 上段 ECHA 階段（依標題字面）；下段近 90 天標題 ≤ 20＋看全部
import { fill, el, link } from "../../lib/dom.js";
import { showError, showLoading } from "../../lib/states.js";
import { PFAS_CAP, arr, text } from "../common.js";
import { headlineRow } from "./news-channels.js";

export function renderPfas(node, { data, loading, error, retry, all, onAll }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "PFAS");
  const p = data.pfas || {}, e = p.echa_stage, items = arr(p.items), n = Number.isFinite(p.count) ? p.count : items.length;
  const shown = all ? items : items.slice(0, PFAS_CAP);
  box.append(...[
    el("h3", { text: "ECHA 限制案階段（依標題字面）" }),
    e && e.stage
      ? el("p", { class: "echa" }, el("strong", { text: text(e.stage) }), el("span", { class: "mono", text: `・${text(e.date).slice(0, 10) || "日期不明"}・` }), link(e.url, text(e.title) || text(e.url)))
      : el("p", { class: "state empty", text: "標題未見 ECHA 階段" }),
    el("h3", { text: "近 90 天 PFAS／兩相冷卻液標題" }),
    n === 0 ? el("p", { class: "state empty", text: "近 90 天無" }) : el("ul", { class: "nlist" }, ...shown.map(headlineRow)),
    !all && items.length > PFAS_CAP ? el("button", { type: "button", class: "chip more", onclick: onAll, text: `看全部（${n}）` }) : null].filter(Boolean));
}
