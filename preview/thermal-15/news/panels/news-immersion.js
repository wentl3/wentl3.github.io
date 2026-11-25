// N-03 浸沒競品動態 (`07` D-036): 依業者分組、每組最新 3 則、組依最新日期新到舊；動作小標只在 API 有給時顯示
import { fill, el, link } from "../../lib/dom.js";
import { itemDate, VENDOR_CAP, arr, text, winWord } from "../common.js";
import { showEmpty, showError, showLoading } from "../../lib/states.js";

const latest = (g) => arr(g.items).reduce((m, i) => (text(i.date) > m ? text(i.date) : m), "");

export function renderImmersion(node, { data, loading, error, retry, days }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "浸沒競品動態");
  const groups = arr(data.immersion_vendors).slice().sort((a, b) => (latest(b) > latest(a) ? 1 : latest(b) < latest(a) ? -1 : 0));
  if (!groups.length) return showEmpty(box, `${winWord(days)}無浸沒業者標題`);
  box.append(...groups.map((g) => el("section", { class: "vgroup", "data-vendor": text(g.vendor) },
    el("h3", { text: `${text(g.vendor)} ${Number.isFinite(g.count) ? g.count : arr(g.items).length} 則` }),
    el("ul", { class: "nlist" }, ...arr(g.items).slice(0, VENDOR_CAP).map((it) => el("li", { class: "nrow" },
      el("span", { class: "mono", text: itemDate(it) }),
      ...arr(it.actions).map((a) => el("span", { class: "tag muted", text: text(a) })),
      link(it.url, text(it.title) || text(it.url) || "（無標題）")))))));
}
