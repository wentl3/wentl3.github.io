// P-09 參考庫格 (`07` v0.6): 搜尋；付費文件只顯示摘要與連結
import { CELL_ROWS } from "../config.js";
import { appendUntagged, capped, itemCard } from "../lib/cards.js";
import { fill, el } from "../lib/dom.js";
import { DOC_ZH } from "../lib/format.js";
import { showEmpty, showError, showLoading } from "../lib/states.js";

export function renderLibrary(node, { sel, reason, untagged, data, loading, error, retry, query, onQuery, expanded = false, onToggle, onPick }) {
  const list = el("div", { class: "list" });
  fill(node, el("div", { class: "panel-head" },
    el("input", { type: "search", placeholder: "搜尋標題", value: query || "", "aria-label": "搜尋參考庫",
      oninput: (e) => onQuery(e.target.value) })), list);
  if (error) return showError(list, error, retry);
  if (loading || !data) return showLoading(list, "參考庫");
  const q = (query || "").toLowerCase();
  const rows = (data.items || []).filter((it) => !q || (it.title || "").toLowerCase().includes(q)
    || (DOC_ZH[it.extraction?.doc_type] || "").includes(q));
  if (!rows.length) showEmpty(list, reason || "參考庫目前沒有符合的文件（手動加入：`cli library --add <url>`）。");
  else list.append(...capped(rows, CELL_ROWS, expanded, onToggle, (it) => itemCard(it, { onPick })));
  appendUntagged(list, sel?.scenario && untagged, (d) => (d.items || []).map((it) => itemCard(it, { onPick })));
}
