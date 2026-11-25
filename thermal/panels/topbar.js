// E-07 頂列 (`07` v0.6 §2): 資料時間・場景・目前篩選・分享連結
import { SCENARIO_ORDER } from "../config.js";
import { getJson } from "../api.js";
import { fill, el } from "../lib/dom.js";
import { SCENARIO_ZH, countryZh, staleText, updateHint } from "../lib/format.js";

function seg(label, values, names, current, onPick) {
  return el("div", { class: "ctl" }, el("span", { class: "ctl-label", text: label }),
    el("div", { class: "seg", role: "group", "aria-label": label },
      ...values.map((v) => el("button", { type: "button", "aria-pressed": String(v === current), "data-value": v,
        onclick: () => onPick(v), text: names[v] }))));
}

let watching = null;
export function watchRun(on, { fetchMeta = () => getJson("meta"), reload = () => location.reload(), ms = 60000 } = {}) {
  if (!on) { if (watching) clearInterval(watching); watching = null; return; }
  if (watching) return;
  watching = setInterval(async () => {
    try { if (!(await fetchMeta()).run_in_progress) { watchRun(false); reload(); } } catch (e) { /* keep polling */ }
  }, ms);
  if (watching.unref) watching.unref();
}

export function renderTopbar(node, { sel, meta, metaError, hubName, counts, onScenario, onClear, onCopy }) {
  const names = counts ? Object.fromEntries(SCENARIO_ORDER.map((v) => [v, `${SCENARIO_ZH[v]} ${counts[v || "all"] ?? 0}`])) : SCENARIO_ZH; // D-020 E-07
  const stale = meta ? staleText(meta.last_run_at) : null;
  const hint = meta && !metaError ? updateHint(meta.last_run_at, !!meta.run_in_progress) : null;
  const when = meta && meta.last_run_at ? meta.last_run_at.slice(0, 16).replace("T", " ") + " UTC" : "—";
  const running = !!(meta && meta.run_in_progress);
  watchRun(running);
  const active = [
    sel.country && { key: "country", text: `國家：${countryZh(sel.country)}` },
    sel.hub && { key: "hub", text: `樞紐：${hubName || sel.hub}` },
    sel.vendor && { key: "vendor", text: `業者：${sel.vendor}` },
  ].filter(Boolean);
  fill(node,
    el("div", { class: "title" },
      el("h1", { text: "資料中心散熱架構情報" }),
      el("div", { class: "mono muted" },
        el("span", { text: `資料更新 ${when}` }),
        stale ? el("span", { class: "badge stale", text: stale }) : null,
        hint ? el("span", { class: "badge", text: hint }) : null,
        running ? el("span", { class: "badge", text: "更新中" }) : null,
        metaError ? el("span", { class: "badge offline", text: "無法連線到 Pipeline API" }) : null)),
    el("div", { class: "controls" },
      seg("場景", SCENARIO_ORDER, names, sel.scenario, onScenario),
      el("div", { class: "ctl filters", "aria-label": "目前篩選" },
        el("span", { class: "ctl-label", text: "篩選" }),
        active.length
          ? el("span", { class: "chips" },
            ...active.map((a) => el("button", { type: "button", class: "chip", "aria-pressed": "true", title: "清除這項",
              "data-clear": a.key, onclick: () => onClear([a.key]), text: `${a.text} ×` })),
            active.length > 1 ? el("button", { type: "button", class: "chip", onclick: () => onClear(active.map((a) => a.key)), text: "全部清除" }) : null)
          : el("span", { class: "muted", text: "全球・全部業者（點卡片上的國家／業者標籤可篩）" })),
      el("button", { type: "button", class: "chip", onclick: onCopy, text: "複製分享連結" })));
}
