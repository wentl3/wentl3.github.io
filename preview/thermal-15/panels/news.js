// P-03 新聞格 (`07` v0.7): 事件（K1 風聲／確認）／文章／全部標題；類型篩選（含標案，T4）
import { CELL_ROWS } from "../config.js";
import { appendUntagged, capped, headlineRow, itemCard } from "../lib/cards.js";
import { GROUP_ZH, eventCard } from "../lib/eventcard.js";
import { aiBox, digestView } from "../lib/ai.js";
import { fill, el } from "../lib/dom.js";
import { DOC_ZH, SCENARIO_ZH, countryZh } from "../lib/format.js";
import { FOCUSES } from "../lib/share.js";
import { showEmpty, showError, showLoading } from "../lib/states.js";

export const NEWS_TYPES = ["", "regulation", "standard", "deployment", "case_study", "product", "tender", "news", "whitepaper", "reference_design"];

export const FOCUS_ZH = { tech: "技術・產品", market: "市場・案子", site_policy: "選址・政策", all: "全部" };
const GROUPS = ["", "reg", "deploy", "product", "other"];
const SIGNALS = [["", "風聲＋確認"], ["rumour", "只看風聲"], ["confirmed", "只看確認"]];
const EMPTY = { events: "這個篩選下還沒有事件；可切到「全部標題」看原始標題。", items: "這個篩選下還沒有已抽取的情報；可切到「全部標題」看原始標題。",
  headlines: "還沒有標題（Pipeline 尚未抓取）。" };

export function renderNews(node, { reason, untagged, sel, view, docType, group = "", signal = "", focus = "tech", data, loading, error, retry, onView, onType, onGroup, onSignal, onFocus = () => {}, expanded = false, onToggle, onPick, load }) {
  const scope = [sel.country && countryZh(sel.country), sel.scenario && SCENARIO_ZH[sel.scenario], sel.vendor].filter(Boolean).join("・");
  const list = el("div", { class: "list" });
  const digest = aiBox(load, "本週摘要（AI 彙整・附出處）", "digest", { scenario: sel.scenario || "all" }, digestView);
  digest.firstChild.append(el("small", { class: "muted", "data-digest-scope": "1", text: " 只隨場景，不隨國家／業者" }));
  fill(node, 
    el("div", { class: "panel-head" },
      el("div", { class: "seg", role: "group", "aria-label": "新聞範圍" },
        el("button", { type: "button", "aria-pressed": String(view === "events"), onclick: () => onView("events"), text: "事件" }),
        el("button", { type: "button", "aria-pressed": String(view === "items"), onclick: () => onView("items"), text: "文章" }),
        el("button", { type: "button", "aria-pressed": String(view === "headlines"), onclick: () => onView("headlines"), text: "全部標題" })),
      view !== "headlines" ? el("div", { class: "seg", role: "group", "aria-label": "焦點視角", "data-focus-seg": "1" },
        ...FOCUSES.map((f) => el("button", { type: "button", "data-focus": f, "aria-pressed": String(f === focus), onclick: () => onFocus(f), text: FOCUS_ZH[f] }))) : null,
      view === "items" ? el("select", { "aria-label": "類型", onchange: (e) => onType(e.target.value) },
        ...NEWS_TYPES.map((t) => el("option", { value: t, selected: t === docType, text: t ? DOC_ZH[t] : "全部類型" })))
        : view === "events" ? el("select", { "aria-label": "事件類型", onchange: (e) => onGroup(e.target.value) },
          ...GROUPS.map((g) => el("option", { value: g, selected: g === group, text: g ? GROUP_ZH[g] : "全部類型" }))) : null,
      view === "events" ? el("select", { "aria-label": "訊號強度", onchange: (e) => onSignal(e.target.value) },
        ...SIGNALS.map(([v, t]) => el("option", { value: v, selected: v === signal, text: t }))) : null,
      el("span", { class: "muted", text: scope ? `篩選：${scope}` : "全部國家・全部場景" })),
    digest,
    view !== "headlines" && focus === "site_policy" ? el("p", { class: "note", "data-focus-hint": "1", text: "選址與政策條件請看地圖與國家條件欄" }) : null,
    view === "headlines" ? el("p", { class: "note", text: sel.country
      ? "選了國家時只列已抽取的標題（未抽取的沒有國家資訊，不從標題猜）。"
      : "原始標題含未抽取的（只附原文連結）；不分場景與業者。" }) : null,
    list);
  if (error) return showError(list, error, retry);
  if (loading || !data) return showLoading(list, "新聞");
  const rows = (view === "events" ? data.events : view === "items" ? data.items : data.headlines) || [];
  const card = (r) => (view === "events" ? eventCard(r, { onPick }) : view === "items" ? itemCard(r, { onPick }) : headlineRow(r));
  const un = view === "headlines" || !sel.scenario ? null : untagged; // 未抽取標題沒有場景，不猜
  const more = () => appendUntagged(list, un, (d) => ((view === "events" ? d.events : d.items) || []).map(card));
  if (!rows.length) { showEmpty(list, (view === "events" && reason) || EMPTY[view] || EMPTY.headlines); return more(); }
  if (view === "events") list.append(el("p", { class: "note", text: focus === "all" ? `${rows.length} 件事件・由已抽取 ${data.accepted ?? rows.length} 篇文章合併（同國、同類、同主體、60 天內）`
    : `${rows.length} 件事件（視角：${FOCUS_ZH[focus] || focus}；同國、同類、同主體、60 天內合併）` }));
  list.append(...capped(rows, CELL_ROWS, expanded, onToggle, card));
  more();
}
