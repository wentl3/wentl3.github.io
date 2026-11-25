// H-03 平台 × 散熱方式矩陣 (`07` D-029): 列＝機型（新到舊，最多 15 列＋看全部），欄＝Air／DLC／1PIC／2PIC；
// 格＝有出的廠商名＋最新日期；空格寫原因；點格 → H-02 篩到該機型＋散熱方式
import { fill, el } from "../../lib/dom.js";
import { shortDate } from "../../lib/format.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";
import { COOLINGS, MATRIX_ROWS, modelKey } from "../common.js";

export function renderMatrix(node, { data, loading, error, retry, days, win = `近 ${days} 天`, cool, focus, all = false, onPick, onAll }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "矩陣");
  const mx = data.matrix || [];
  if (!mx.length) return showEmpty(box, `${win}沒有機型可列入矩陣（與產品動態表同一批資料；散熱方式篩選也會縮小矩陣）。`);
  const reason = (c) => (cool && c !== cool ? `已篩選為 ${cool}` : `${win}無資料`); // not 無資料: the filter, not the data, emptied the column
  const rows = (all ? mx : mx.slice(0, MATRIX_ROWS)).map((r) => el("tr", { class: "mx-row", "data-model": r.model },
    el("th", { scope: "row", text: r.model }),
    ...COOLINGS.map((c) => {
      const cell = r.cells && r.cells[c];
      if (!cell) return el("td", { class: "null muted", "data-cool": c, text: reason(c) });
      const on = !!focus && focus.key === modelKey(r.model) && focus.cool === c;
      return el("td", { class: "mx-cell", "data-cool": c },
        el("button", { type: "button", class: "cellbtn", "aria-pressed": String(on), title: `${Number.isFinite(cell.n) ? `${cell.n} 則來源・` : ""}點選：篩選產品動態表`,
          onclick: () => onPick({ key: modelKey(r.model), model: r.model, cool: c, vendors: cell.vendors || [] }) },
        el("span", { text: (cell.vendors || []).join("、") }), el("span", { class: "mono muted small", text: shortDate(cell.date) })));
    })));
  fill(box, // fill skips null (Element.append would print "null")
    el("div", { class: "tbl-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, el("th", { text: "機型／平台" }), ...COOLINGS.map((c) => el("th", { text: c })))), el("tbody", {}, ...rows))),
    mx.length > MATRIX_ROWS ? el("button", { type: "button", class: "chip more", onclick: onAll, text: all ? "收合" : `看全部（共 ${mx.length} 列）` }) : null);
}
