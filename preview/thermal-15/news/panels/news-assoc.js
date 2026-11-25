// N-05 協會規格版本表 (`07` D-036): API 固定 4 列；版本只取規則表抽出的字樣，取不到寫「標題未見版本號」，不推測
import { fill, el, link } from "../../lib/dom.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";
import { arr, itemDate, text } from "../common.js";

export function renderAssoc(node, { data, loading, error, retry }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "協會規格版本");
  const rows = arr(data.assoc_specs);
  if (!rows.length) return showEmpty(box, "近 730 天無標題（未查到≠沒有）");
  box.append(el("div", { class: "tbl-wrap" }, el("table", {},
    el("thead", {}, el("tr", {}, ...["規格", "最新日期", "版本", "標題", "近 730 天"].map((h) => el("th", { text: h })))),
    el("tbody", {}, ...rows.map((r) => {
      const l = r.latest, n = Number.isFinite(r.count_730d) ? r.count_730d : 0;
      return el("tr", { class: "arow", "data-spec": text(r.id) }, el("td", { text: text(r.label) }),
        l && n > 0
          ? [el("td", { class: "mono", text: itemDate(l) }), el("td", { text: text(l.version) || "標題未見版本號" }), el("td", {}, link(l.url, text(l.title) || text(l.url))), el("td", { text: `${n} 則` })]
          : [el("td", { class: "muted", colspan: "3", text: `近 730 天${text(r.scope && r.scope.rule) ? `、${text(r.scope.rule)}` : ""}：0 則（未查到≠沒有）` }), el("td", { text: "0 則" })]);
    })))));
}
