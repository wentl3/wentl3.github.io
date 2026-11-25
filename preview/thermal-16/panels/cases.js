// P-08 案例格 (07 D-029)
import { CELL_ROWS } from "../config.js";
import { appendUntagged, capped, itemCard } from "../lib/cards.js";
import { eventCard } from "../lib/eventcard.js";
import { fill, el } from "../lib/dom.js";
import { CLAIMANT_ZH } from "../lib/format.js";
import { showEmpty, showError, showLoading } from "../lib/states.js";

export function renderCases(node, { sel, reason, untagged, data, loading, error, retry, expanded = false, onToggle, onPick }) {
  const list = el("div", { class: "list" });
  fill(node, list);
  if (error) return showError(list, error, retry);
  if (loading || !data) return showLoading(list, "案例");
  const ts = ({ c, ev }) => Date.parse(((c ? c.item?.published_at : ev.last_published_at) || "").slice(0, 10)) || 0;
  const rowsOf = (d) => { const cs = d.cases || []; const pin = new Set(cs.map((c) => c.item_id || c.item?.id).filter(Boolean));
    return [...cs.map((c) => ({ c })), ...(d.events || []).filter((ev) => ev.is_event !== false && !pin.has((ev.sources || [])[0]?.item_id)).map((ev) => ({ ev }))]
      .sort((a, b) => ts(b) - ts(a)); }; // stable: case first on tie
  const draw = ({ c, ev }) => {
    if (ev) return eventCard(ev, { compact: true, onPick });
    const card = itemCard(c.item, { onPick });
    card.insertBefore(el("div", { class: "case-facts" },
      ...[["客戶", c.client_type], ["規模", c.scale_note], ["成效", c.outcome_note]].map(([k, v]) => el("span", { text: `${k}：${v}` })),
      el("span", { class: "tag warn", text: CLAIMANT_ZH[c.claimant] || c.claimant })),
    card.children[1]);
    return card;
  };
  const rows = rowsOf(data);
  if (!rows.length) showEmpty(list, reason || "這個篩選下還沒有部署事件或人工案例。");
  else list.append(...capped(rows, CELL_ROWS, expanded, onToggle, draw));
  appendUntagged(list, sel?.scenario && untagged, (d) => rowsOf(d).map(draw));
}
