// E-04 業者格 (`07` v0.6): 註冊表下拉＋動態；選了業者全頁（含地圖計數）一起篩
import { CELL_ROWS } from "../config.js";
import { appendUntagged, capped, itemCard } from "../lib/cards.js";
import { fill, el } from "../lib/dom.js";
import { showEmpty, showError, showLoading } from "../lib/states.js";

/** D-020 E-04: 「名稱（N）」；N＝0 → 「名稱（0・原因）」，原因中文來自 /coverage。 */
function optionText(name, counts) {
  const c = counts && counts[name];
  return !c ? name : c.n ? `${name}（${c.n}）` : `${name}（0・${c.zh}）`;
}

export function renderVendors(node, { sel, registry, vendor_counts, reason, untagged, data, loading, error, retry, onVendor, expanded = false, onToggle, onPick }) {
  const picker = el("select", { "aria-label": "選業者", onchange: (e) => onVendor(e.target.value) },
    el("option", { value: "", text: "全部業者（最新動態）" }),
    ...(registry || []).map((v) => el("option", { value: v.name, selected: sel.vendor === v.name, "data-vendor": v.name, text: optionText(v.name, vendor_counts) })));
  const list = el("div", { class: "list" });
  fill(node, el("div", { class: "panel-head" }, picker,
    el("span", { class: "muted small", text: sel.vendor ? "地圖計數、國家條件與四格都只看這家" : "選一家業者會全頁一起篩" })), list);
  if (error) return showError(list, error, retry);
  if (loading || !data) return showLoading(list, sel.vendor ? `${sel.vendor} 動態` : "業者動態");
  const rows = (data.items || []).filter((it) => sel.vendor || (it.extraction?.vendors || []).length);
  if (!rows.length) showEmpty(list, reason || (sel.vendor ? `${sel.vendor} 在目前的國家／場景篩選下沒有已抽取情報。` : "目前篩選下沒有提到業者的情報。"));
  else list.append(...capped(rows, CELL_ROWS, expanded, onToggle, (it) => itemCard(it, { onPick })));
  appendUntagged(list, sel.scenario && untagged, (d) => (d.items || []).map((it) => itemCard(it, { onPick })));
}
