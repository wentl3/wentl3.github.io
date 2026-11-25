// H-01 第二頁頁頭 (`07` D-029): 頁名・資料時間（同 E-07）・時間窗・散熱方式・回主頁
import { fill, el } from "../../lib/dom.js";
import { staleText, updateHint } from "../../lib/format.js";
import { COOLINGS, COOL_ZH, WINDOWS, confSpan } from "../common.js";

function seg(label, values, name, current, onPick, off = false) {
  return el("div", { class: "ctl", "data-ctl": label }, el("span", { class: "ctl-label", text: label }),
    el("div", { class: "seg", role: "group", "aria-label": label },
      ...values.map((v) => el("button", { type: "button", "aria-pressed": String(v === current), "data-value": v, disabled: off, onclick: () => onPick(v), text: name(v) }))));
}

export function renderHeader(node, { days, cool, conf = "", confs = [], meta, metaError, onDays, onCool, onConf }) {
  const cur = confs.find((c) => c.id === conf);
  const stale = meta ? staleText(meta.last_run_at) : null;
  const hint = meta && !metaError ? updateHint(meta.last_run_at, !!meta.run_in_progress) : null;
  const when = meta && meta.last_run_at ? meta.last_run_at.slice(0, 16).replace("T", " ") + " UTC" : "—";
  fill(node,
    el("div", { class: "title" },
      el("h1", { text: "硬體與散熱動態" }),
      el("div", { class: "mono muted" },
        el("span", { text: `資料更新 ${when}` }),
        stale ? el("span", { class: "badge stale", text: stale }) : null,
        hint ? el("span", { class: "badge", text: hint }) : null,
        meta && meta.run_in_progress ? el("span", { class: "badge", text: "更新中" }) : null,
        metaError ? el("span", { class: "badge offline", text: "無法連線到 Pipeline API" }) : null)),
    el("div", { class: "controls" },
      seg("時間窗", WINDOWS, (v) => `${v} 天`, days, onDays, !!conf),
      seg("散熱方式", ["", ...COOLINGS], (v) => COOL_ZH[v], cool, onCool),
      confs.length ? seg("展會", ["", ...confs.map((c) => c.id)], (v) => (v ? confs.find((c) => c.id === v).name : "無"), conf, onConf) : null,
      cur ? el("span", { class: "mono muted small", text: confSpan(cur) }) : null,
      el("a", { class: "back", href: "index.html", text: "← 回主頁" })));
}
