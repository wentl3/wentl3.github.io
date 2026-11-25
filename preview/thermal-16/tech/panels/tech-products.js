// H-02 產品動態表 (`07` D-029): 一列＝API 一列（日期｜廠商｜機型／平台｜散熱方式｜套件／選配｜動作｜來源數）；
// 單一廠商最多 3 列，其餘「<廠商> 另 N 則」；點列展開逐字引文與原文連結
import { fill, el, link } from "../../lib/dom.js";
import { shortDate } from "../../lib/format.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";
import { ACTION_ZH, COOL_ZH, coolLabel, inWeek, layoutRows, modelKey, rowKey } from "../common.js";

const HEAD = ["日期", "廠商", "機型／平台", "散熱方式", "套件／選配", "動作", "來源數"];

export function renderProducts(node, { data, loading, error, retry, days, win = `近 ${days} 天`, cool, focus, week, expanded = new Set(), onToggle, onClearFocus, onClearWeek }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "產品動態");
  const all = data.rows || [], rows = week ? all.filter((r) => inWeek(r.date, week)) : all;
  if (!all.length) {
    return showEmpty(box, `這個時間窗與散熱方式下沒有產品動態（${win}・${COOL_ZH[cool || ""]}）。產品整理逐輪進行，尚未整理的文章不會出現；可放寬時間窗或改選「全部」。`);
  }
  const hit = focus ? rows.filter((r) => modelKey(r.model) === focus.key && r.cooling === focus.cool) : null;
  const entries = hit ? hit.map((row) => ({ row })) : layoutRows(rows, week ? {} : data.more);
  const missing = hit ? focus.vendors.filter((v) => !hit.some((r) => r.vendor === v)) : [];
  const body = el("tbody");
  for (const e of entries) {
    if (e.more) {
      body.append(el("tr", { class: "pmore", "data-vendor": e.more }, el("td", { colspan: HEAD.length, class: "muted", text: `${e.more} 另 ${e.n} 則` })));
      continue;
    }
    const r = e.row, key = rowKey(r), open = expanded.has(key);
    body.append(el("tr", { class: "prow", "data-key": key },
      el("td", { class: "mono", text: shortDate(r.date) }),
      el("td", { text: r.vendor }),
      el("td", {}, el("button", { type: "button", class: "linkbtn", "aria-expanded": String(open), onclick: () => onToggle(key), text: r.model }),
        r.platform ? el("div", { class: "muted small", text: r.platform }) : null),
      el("td", {}, el("span", { class: "tag tech", text: coolLabel(r) })),
      el("td", { text: r.kit || "—" }),
      el("td", { text: ACTION_ZH[r.action] || r.action || "—" }),
      el("td", { class: "mono", text: (r.sources || []).length })));
    if (open) {
      body.append(el("tr", { class: "pdetail" }, el("td", { colspan: HEAD.length },
        r.summary_zh ? el("p", { text: r.summary_zh }) : null,
        r.quote ? el("q", { text: r.quote }) : null,
        r.subtype_quote ? el("div", { class: "muted small", text: `DLC 類型依據：${r.subtype_quote}` }) : null,
        el("div", { class: "meta" }, el("span", { text: "原文：" }), link(r.url, r.title || r.url || "原文"), el("span", { class: "tag ok", text: "AI 抽取・逐字引文" })))));
    }
  }
  fill(box, // fill skips null (Element.append would print "null")
    el("div", { class: "panel-head" },
      el("span", { class: "muted", text: `${hit ? hit.length : rows.length} 列（${win}・${COOL_ZH[cool || ""]}）` }),
      week ? el("button", { type: "button", class: "chip", "data-clear-week": "1", title: "清除週篩選", onclick: onClearWeek, text: `週：${week} ×` }) : null,
      focus ? el("button", { type: "button", class: "chip", "data-clear-focus": "1", title: "清除機型篩選", onclick: onClearFocus, text: `機型：${focus.model}・${COOL_ZH[focus.cool]} ×` }) : null),
    week && !rows.length ? el("p", { class: "state empty", text: "這一週沒有列。" }) : null,
    hit && !hit.length ? el("p", { class: "state empty", text: "表中沒有符合這個格的列。" }) : null,
    missing.length ? el("p", { class: "note", text: `${missing.join("、")} 的這個機型列超過每家 3 列的上限，未列在表中。` }) : null,
    el("div", { class: "tbl-wrap" }, el("table", {}, el("thead", {}, el("tr", {}, ...HEAD.map((h) => el("th", { text: h })))), body)));
}
