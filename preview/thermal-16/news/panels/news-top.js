// N-08 本週大事 (`07` D-037): API top_stories 前 5；每列 代表標題｜N 個網域｜日期｜展開看各網域連結
import { fill, el } from "../../lib/dom.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";
import { TOP_CAP, arr, itemDate, text, winWord } from "../common.js";
import { headlineRow } from "./news-channels.js";

export function renderTop(node, { data, loading, error, retry, days, expanded, onExpand }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "本週大事");
  const rows = arr(data.top_stories).slice(0, TOP_CAP);
  if (!rows.length) return showEmpty(box, `${winWord(days)}沒有多家媒體同報的標題`);
  box.append(el("ol", { class: "nlist" }, ...rows.map((r, i) => {
    const key = `top:${i}`, open = expanded.has(key), items = arr(r.items), d = text(r.date).slice(0, 10);
    return el("li", { class: "trow", "data-rank": i + 1 },
      el("div", { class: "nrow" }, el("strong", { text: text(r.title) || "（無標題）" }),
        el("span", { class: "tag", text: `${Number.isFinite(r.domains) ? r.domains : 0} 個網域` }),
        el("span", { class: "mono", text: d || "日期未知" }),
        !open && items.length ? el("button", { type: "button", class: "chip", onclick: () => onExpand(key), text: "展開各網域" }) : null,
        r.summary_zh ? el("p", { class: "nsum", text: r.summary_zh }) : null),
      open ? el("ul", { class: "nlist" }, ...items.map((it) => headlineRow(it))) : null);
  })));
}
