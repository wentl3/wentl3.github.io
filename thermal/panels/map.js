// E-08 圖層控制＋圖例（`07` v0.6 §2, D-014）; SVG is ../map.js
import { LEGEND } from "../lib/counts.js";
import { BIVAR_LAYERS, ESTIMATE_NOTE, LAYERS, LAYER_BY_ID, LAYER_GROUPS, cutsText } from "../lib/layers.js";
import { fill, el } from "../lib/dom.js";
import { SCENARIO_ZH } from "../lib/format.js";

const OVERLAYS = [["dots", "情報點"], ["hubs", "樞紐"], ["cons", "限制訊號"], ["pins", "事件廠址"]];

function select(label, value, options, onChange) {
  return el("label", { class: "ctl" }, el("span", { class: "ctl-label", text: label }),
    el("select", { "aria-label": label, onchange: (e) => onChange(e.target.value) },
      ...options.map(([v, zh]) => el("option", { value: v, selected: v === value, text: zh }))));
}

function groupedSelect(label, value, onChange) {
  return el("label", { class: "ctl" }, el("span", { class: "ctl-label", text: label }),
    el("select", { "aria-label": label, onchange: (e) => onChange(e.target.value) },
      ...LAYER_GROUPS.map((g) => el("optgroup", { label: g.zh },
        ...LAYERS.filter((l) => l.group === g.id).map((l) => el("option", { value: l.id, selected: l.id === value, text: l.zh }))))));
}

function bivarLegend(a, b, cuts3) {
  const grid = el("div", { class: "bivar-grid", role: "img", "aria-label": "雙變量 3×3 圖例" });
  for (let j = 2; j >= 0; j--) for (let i = 0; i <= 2; i++) grid.append(el("span", { class: `bv b${i}${j}` }));
  return el("div", { class: "legend-bivar" }, grid,
    el("div", {}, el("div", { text: `→ ${cutsText(a, cuts3[a] || [])}` }), el("div", { text: `↑ ${cutsText(b, cuts3[b] || [])}` })));
}

export function renderMapControls(node, { sel, rule, stats, overlays, cuts3, onMode, onX, onFilt, onRuleValue, onOverlay }) {
  const xOptions = [["", "（不交叉）"], ...BIVAR_LAYERS.filter((id) => id !== sel.mode).map((id) => [id, LAYER_BY_ID[id].zh])];
  const canCross = BIVAR_LAYERS.includes(sel.mode);
  fill(node,
    el("div", { class: "map-ctl-row" },
      groupedSelect("底圖", sel.mode, onMode),
      canCross ? select("交叉", sel.x, xOptions, onX) : el("span", { class: "muted small", text: "交叉：先選數值底圖" }),
      el("label", { class: "ctl" }, el("input", { type: "checkbox", checked: sel.filt === "1", onchange: (e) => onFilt(e.target.checked) }),
        el("span", { text: `場景條件篩選（${SCENARIO_ZH[sel.scenario]}）` })),
      ...OVERLAYS.map(([k, zh]) => el("label", { class: "ctl" },
        el("input", { type: "checkbox", checked: overlays[k], "data-overlay": k, onchange: () => onOverlay(k) }), el("span", { text: zh })))),
    sel.filt === "1" ? el("div", { class: "map-ctl-row rule", "data-rule": "" },
      rule.length
        ? [el("span", { class: "tag warn", text: "假設值" }),
          ...rule.map((c, i) => el("label", { class: "ctl" }, el("span", { text: `${c.zh} ${c.op === ">=" ? "≥" : "≤"}` }),
            el("input", { type: "number", value: String(c.value), step: "any", "aria-label": c.zh, class: "num",
              onchange: (e) => onRuleValue(i, Number(e.target.value)) }))),
          el("span", { class: stats.match ? "muted" : "state empty inline", "data-match": String(stats.match),
            text: stats.match ? `符合 ${stats.match}／有資料 ${stats.withData} 國（無資料的國家不算符合）` : `沒有國家符合（有資料 ${stats.withData} 國）` })]
        : el("span", { class: "muted", text: `「${SCENARIO_ZH[sel.scenario]}」沒有預設門檻（不以氣候條件篩）` })) : null);
}

export function pinLegend(pins) {
  const n = (k) => (pins && pins[k]) || 0;
  return el("div", { class: "small legend-pins", "data-pins": String(n("site") + n("hub")) },
    el("span", { class: "pin-key site", text: "▼" }), el("span", { text: ` 廠址（城市）${n("site")} ` }),
    el("span", { class: "pin-key hub", text: "▼" }), el("span", { text: ` 樞紐 ${n("hub")}・只寫到國家的事件不畫圖釘（算在國家情報點）` }));
}

export function renderLegend(node, { sel, cuts3, overlays = {}, pins = null }) {
  const layer = LAYER_BY_ID[sel.mode] || LAYER_BY_ID.policy;
  const crossing = sel.x && BIVAR_LAYERS.includes(sel.mode) && sel.x !== sel.mode;
  const climate = [sel.mode, crossing ? sel.x : ""].some((id) => /^(fc|wb|db|hdd)/.test(id));
  fill(node,
    crossing ? bivarLegend(sel.mode, sel.x, cuts3)
      : el("span", { text: layer.kind === "numeric" ? `${layer.zh}（${layer.unit}）：淺＝低 → 深＝高（四分位）・斜線＝未取得`
        : layer.kind === "reg" ? `${layer.zh}：淺＝提案／徵詢・中＝已通過・深＝已生效（依最新法規事件）・斜線＝未查到（不代表沒有此法規）`
          : LEGEND[layer.id] }),
    climate ? el("div", { class: "small", text: ESTIMATE_NOTE }) : null,
    sel.filt === "1" ? el("div", { class: "small", text: "篩選中：符合＝原色，其他＝淡化" }) : null,
    overlays.pins ? pinLegend(pins) : null);
}
