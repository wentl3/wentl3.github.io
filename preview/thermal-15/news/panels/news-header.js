// N-01 新聞頁頁頭 (`07` D-036): 頁名・資料時間・時間窗・主頁／第二頁連結・停放字樣
import { fill, el } from "../../lib/dom.js";
import { WINDOWS, lagDays } from "../common.js";

export function renderHeader(node, { days, meta, metaError, data, onDays }) {
  const lag = meta && meta.last_run_at ? lagDays(meta.last_run_at) : null;
  const when = meta && meta.last_run_at ? meta.last_run_at.slice(0, 16).replace("T", " ") + " UTC" : "—";
  const ins = (data && data.insurance) || {};
  fill(node,
    el("div", { class: "title" },
      el("h1", { text: "散熱新聞面板" }),
      el("div", { class: "mono muted" },
        el("span", { text: `資料更新 ${when}` }),
        lag !== null ? el("span", { class: "badge stale", text: `資料停在 ${lag} 天前` }) : null,
        metaError ? el("span", { class: "badge offline", text: "無法連線到 Pipeline API" }) : null),
      el("div", { class: "small muted", text: "原始標題・未經 AI 抽取" }),
      data && Number.isFinite(data.undated_total) ? el("div", { class: "small muted", text: `日期未知 ${data.undated_total} 則（不進各欄主清單）` }) : null,
      ins.parked === true ? el("div", { class: "badge stale", text: "已停放（14 天保險）：排程不再更新" }) : null,
      ins.pending_answer === true ? el("div", { class: "badge stale", text: "14 天保險待答" }) : null),
    el("div", { class: "controls" },
      el("div", { class: "ctl", "data-ctl": "時間窗" }, el("span", { class: "ctl-label", text: "時間窗" }),
        el("div", { class: "seg", role: "group", "aria-label": "時間窗" },
          ...WINDOWS.map((v) => el("button", { type: "button", "aria-pressed": String(v === days), "data-value": v, onclick: () => onDays(v), text: v === 7 ? "本週（近 7 天）" : "近 30 天" })))),
      el("a", { href: "index.html", text: "主頁" }),
      el("a", { href: "tech.html", text: "硬體與散熱動態" })));
}
