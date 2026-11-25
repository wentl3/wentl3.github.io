// N-02 渠道分欄 (`07` D-037): 7 欄固定順序；欄頭 N＝API count＋週對比；每欄 ≤ 5，看全部展開到 API items 全部（少於 count 寫「顯示 X／N」）；欄尾日期未知；欄下未分類
import { fill, el, link } from "../../lib/dom.js";
import { showError, showLoading } from "../../lib/states.js";
import { CHANNEL_CAP, CHANNEL_ORDER, arr, itemDate, text, weekText, winWord } from "../common.js";

export function headlineRow(it, labels = new Map()) {
  const also = arr(it.also).map((id) => labels.get(id) || text(id)).filter(Boolean);
  return el("li", { class: "nrow" },
    el("span", { class: "mono", text: itemDate(it) }),
    el("span", { class: "muted small", text: text(it.domain) }),
    link(it.url, text(it.title) || text(it.url) || "（無標題）"),
    also.length ? el("span", { class: "muted small", text: `也在：${also.join("、")}` }) : null,
    ...arr(it.conf).map((c) => el("span", { class: "tag conf", text: text(c) })),
    it.summary_zh ? el("p", { class: "nsum", text: it.summary_zh }) : null);
}

/** One expandable list: `key` in `expanded` → all items (plus 「顯示 X／N」 if the API capped them), else the first `cap`. */
export function listBlock({ items, n, key, open, cap, labels, onExpand, label }) {
  const shown = open ? items : items.slice(0, cap);
  return [el("ul", { class: "nlist" }, ...shown.map((it) => headlineRow(it, labels))),
  open && items.length < n ? el("p", { class: "note", text: `顯示 ${items.length}／${n}` }) : null,
  !open && items.length > cap ? el("button", { type: "button", class: "chip more", onclick: () => onExpand(key), text: label }) : null];
}
const count = (c, items) => (Number.isFinite(c) ? c : items.length);

export function renderChannels(node, { data, loading, error, retry, days, expanded, onExpand }) {
  const box = el("div", { class: "cols" });
  const wrap = el("div", {}, box);
  fill(node, wrap);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "渠道分欄");
  const byId = new Map(arr(data.channels).map((c) => [c.id, c]));
  const labels = new Map(arr(data.channels).map((c) => [c.id, text(c.label)]));
  for (const id of CHANNEL_ORDER) {
    const c = byId.get(id);
    if (!c) continue;
    const items = arr(c.items), n = count(c.count, items), wk = weekText(c.week);
    const und = c.undated && typeof c.undated === "object" ? c.undated : null, uItems = arr(und && und.items), un = und ? count(und.count, uItems) : 0;
    const uKey = `undated:${id}`;
    box.append(el("section", { class: "col", "data-channel": id },
      el("h3", { text: `${text(c.label)} ${n} 則${wk ? `・${wk}` : ""}` }),
      c.summary_zh ? el("p", { class: "chsum", text: c.summary_zh }) : null,
      n === 0 ? el("p", { class: "state empty", text: `${winWord(days)}無` })
        : el("div", {}, ...listBlock({ items, n, key: id, open: expanded.has(id), cap: CHANNEL_CAP, labels, onExpand, label: `看全部（${n}）` })),
      un > 0 ? el("div", { class: "undated" },
        el("p", { class: "note", text: `另有日期未知 ${un} 則${expanded.has(uKey) || !uItems.length ? "" : "（展開）"}` }),
        uItems.length && !expanded.has(uKey) ? el("button", { type: "button", class: "chip more", onclick: () => onExpand(uKey), text: `展開日期未知（${un}）` })
          : el("div", {}, ...listBlock({ items: uItems, n: un, key: uKey, open: true, cap: 0, labels, onExpand, label: "" }))) : null));
  }
  const unc = data.unclassified_items && typeof data.unclassified_items === "object" ? data.unclassified_items : null;
  const uItems = arr(unc && unc.items), un = Number.isFinite(data.unclassified) ? data.unclassified : unc ? count(unc.count, uItems) : null;
  if (un === null) return;
  if (!uItems.length || un === 0) return wrap.append(el("p", { class: "note", text: `未分類 ${un} 則` }));
  wrap.append(el("div", { class: "unclassified" },
    el("p", { class: "note", text: `未分類 ${un} 則${expanded.has("unc") ? "" : "（展開）"}` }),
    expanded.has("unc") ? el("div", {}, ...listBlock({ items: uItems, n: un, key: "unc", open: true, cap: 0, labels, onExpand, label: "" }))
      : el("button", { type: "button", class: "chip more", onclick: () => onExpand("unc"), text: `展開未分類（${un}）` })));
}
