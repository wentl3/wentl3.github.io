// H-04 協會與標準側欄 (`07` D-029): 協會名、中文標題（無則原標題標「未抽取」）、日期、原文連結；每協會最多 3 則
import { fill, el, link } from "../../lib/dom.js";
import { shortDate } from "../../lib/format.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";

export function renderAssoc(node, { data, loading, error, retry, days, win = `近 ${days} 天` }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "協會動態");
  const groups = data.associations || [];
  if (!groups.length) return showEmpty(box, `${win}沒有協會動態`);
  box.append(...groups.map((g) => el("section", { class: "assoc", "data-assoc": g.association },
    el("h3", { text: `${g.association}（${g.total}）` }),
    ...(g.items || []).map((it) => el("article", { class: "item" },
      el("div", { class: "ttl" }, link(it.url, it.headline_zh || it.title || it.url)),
      el("div", { class: "meta" }, el("span", { class: "mono", text: shortDate(it.date) }),
        it.headline_zh ? null : el("span", { class: "tag muted", text: "未抽取" })))),
    g.total > (g.items || []).length ? el("p", { class: "note", text: `共 ${g.total} 則，這裡列最新 ${(g.items || []).length} 則` }) : null)));
}
