// E-03 國家條件欄 (`07` v0.7 §2): 未選＝全球最新法規事件；選國家＝條件＋事件；選樞紐＝散熱適配卡
import { FIT_RULES, GLOBAL_ROWS } from "../config.js";
import { aiBox, strategyView } from "../lib/ai.js";
import { eventCard } from "../lib/eventcard.js";
import { waterBand } from "../lib/counts.js";
import { fill, el, link } from "../lib/dom.js";
import { CONSTRAINT_ZH, FACTOR_ZH, SCENARIO_ZH, countryZh } from "../lib/format.js";
import { ESTIMATE_NOTE, LAYER_BY_ID, coolingFit } from "../lib/layers.js";
import { showError, showLoading } from "../lib/states.js";

const CLIMATE = ["climate_freecool_w32_h", "climate_freecool_w45_h", "climate_wetbulb_max", "climate_drybulb_p04", "climate_hdd18"];
const ROWS = [
  { label: "政策", docTypes: ["regulation", "standard"], factors: [] },
  { label: "水資源", factors: ["water_stress"] },
  { label: "能源", factors: ["grid_carbon_intensity", "electricity_price"] },
  { label: "氣候", factors: CLIMATE, note: ESTIMATE_NOTE },
];
const POWER = ["grid_moratorium", "grid_capacity", "generation_expansion"];

function num(v) {
  return typeof v === "number" ? (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : String(v)) : v ?? "—";
}

function factorLine(name, row, reason) {
  if (row) {
    const value = name === "water_stress" ? `${waterBand(row.band).zh}（${row.band}）` : `${num(row.value)} ${row.unit ?? ""}`;
    return el("div", { class: "fact" }, el("span", { text: `${FACTOR_ZH[name] || name}：${value}` }),
      el("span", { class: "src" }, link(row.source_url, row.dataset),
        el("span", { class: "mono", text: ` · ${row.as_of} · ${row.license}${row.point ? ` · 代表點 ${row.point}` : ""}` })));
  }
  return el("div", { class: "fact na", text: reason || `${FACTOR_ZH[name] || name}：未取得（原因未提供）` });
}

function countrySelect(sel, countryList, onCountry) {
  return el("select", { "aria-label": "選擇國家", onchange: (e) => onCountry(e.target.value) },
    el("option", { value: "", text: "— 全球（點地圖或選國家）—" }),
    ...[...countryList].sort((a, b) => countryZh(a).localeCompare(countryZh(b), "zh-Hant"))
      .map((iso) => el("option", { value: iso, selected: iso === sel.country, text: `${countryZh(iso)} ${iso}` })));
}

function globalView(body, { sel, global, onPick, retry }) {
  const scen = sel.scenario ? `・${SCENARIO_ZH[sel.scenario]}` : "";
  if (!global || global.loading) return showLoading(body, "全球最新變動");
  if (global.error) return showError(body, global.error, retry);
  const rows = global.events || [];
  body.append(el("h3", { text: `全球最新法規／標準變動${scen}` }),
    el("p", { class: "note", "data-global": String(rows.length), text: `最新 ${Math.min(rows.length, GLOBAL_ROWS)}／共 ${rows.length} 件事件・點國家標籤看該國條件` }));
  if (!rows.length) return body.append(el("p", { class: "state empty", text: "目前沒有抓到法規或標準（可換場景，或看下方新聞）。" }));
  body.append(el("div", { class: "list" }, ...rows.slice(0, GLOBAL_ROWS).map((ev) => eventCard(ev, { compact: true, onPick }))));
}

function hubView(body, { hub, brief, onPick }) {
  const cons = hub.counts?.constraints || {};
  const consLine = (types) => {
    const hit = types.filter((t) => cons[t]);
    return hit.length ? hit.map((t) => `${CONSTRAINT_ZH[t]} ${cons[t]} 則`).join("、") : "未抓到訊號（沒有訊號≠沒有限制）";
  };
  const factors = brief?.factors || {};
  const fit = coolingFit(factors, cons, FIT_RULES);
  const dl = el("dl", { class: "kv" },
    el("dt", { text: "電力" }), el("dd", { text: consLine(POWER) }),
    el("dt", { text: "許可" }), el("dd", { text: consLine(["permitting", "heat_reuse_mandate", "pue_cap"]) }),
    el("dt", { text: "氣候" }), el("dd", {}, ...CLIMATE.map((f) => factorLine(f, factors[f], brief?.unavailable?.[f])), el("span", { class: "small muted", text: ESTIMATE_NOTE })),
    el("dt", { text: "水" }), el("dd", {}, factorLine("water_stress", factors.water_stress, brief?.unavailable?.water_stress)),
    el("dt", { text: "部署" }), el("dd", { text: `相關情報 ${hub.counts?.items || 0} 則，其中部署／案例 ${hub.counts?.deployments || 0} 則` }));
  body.append(
    el("h3", { text: `${hub.name_zh}（${countryZh(hub.country)}）樞紐` }),
    el("p", { class: "note" }, el("span", { text: "樞紐出處：" }), link(hub.source_url, new URL(hub.source_url).hostname)),
    dl,
    el("h3", { text: "散熱適配（規則推導・不給總分）" }),
    fit.length
      ? el("ul", { class: "fit" }, ...fit.map((f) => el("li", {}, el("span", { text: f.text }), el("span", { class: "small muted", text: `依據：${f.basis}` }))))
      : el("p", { class: "state empty", text: "目前的資料沒有觸發任何規則（門檻為假設值，見 config.js）。" }));
}

function evidenceView(body, { sel, brief, evidence: ev, onPick, onEvidenceBack }) {
  const l = LAYER_BY_ID[ev.layer] || LAYER_BY_ID.policy, rows = ev.events || [], f = brief?.factors?.[l.factor];
  const head = (n) => el("h3", { text: `證據：${countryZh(ev.country)}・${l.zh}${n === null ? "" : `（${n} 件）`}` });
  body.append(el("button", { type: "button", class: "chip", onclick: onEvidenceBack, text: "回到條件" }),
    el("p", { class: "note", text: `篩選：${SCENARIO_ZH[sel.scenario] || "全部"}・${sel.vendor || "全部業者"}` }));
  if (l.kind === "numeric" || l.kind === "band") return body.append(head(null), f ? factorLine(l.factor, f) : el("p", { class: "state empty", text: `${l.zh}：未取得` }));
  if (ev.loading) return showLoading(body, "證據");
  if (ev.error) return showError(body, ev.error);
  body.append(head(rows.length), ...(rows.length ? [el("div", { class: "list" }, ...rows.map((e) => eventCard(e, { compact: true, onPick })))] : []));
}

export function renderConditions(node, { sel, countryList, brief, loading, error, retry, onCountry, global, globalRetry, hub, picked = null, onPick, onBack, evidence = null, onEvidenceBack, load }) {
  const body = el("div", { class: "brief-body" });
  fill(node, el("h2", { text: "國家條件" }), countrySelect(sel, countryList, onCountry),
    sel.country || sel.hub ? el("button", { type: "button", class: "chip", onclick: onBack, text: "← 回到全球" }) : null, body);
  if (!sel.country && !sel.hub) return globalView(body, { sel, global, onPick, retry: globalRetry });
  if (error) return showError(body, error, retry);
  if (loading || !brief) return showLoading(body, `${countryZh(sel.country)}條件`);
  if (sel.hub && hub) return hubView(body, { hub, brief, onPick });
  if (evidence && evidence.country === sel.country) return evidenceView(body, { sel, brief, evidence, onPick, onEvidenceBack });

  const regs = brief.events || [];
  const dl = el("dl", { class: "kv" });
  const shown = new Set();
  for (const row of ROWS) {
    const dd = el("dd");
    if (row.docTypes) {
      dd.append(el("div", { class: regs.length ? "fact" : "fact na",
        text: regs.length ? `法規／標準 ${regs.length} 件事件（見下方）` : `尚無法規／標準情報${sel.scenario ? `（場景：${SCENARIO_ZH[sel.scenario]}）` : ""}` }));
    }
    for (const f of row.factors) {
      shown.add(f);
      dd.append(factorLine(f, brief.factors?.[f], brief.unavailable?.[f]));
    }
    if (row.note && row.factors.some((f) => brief.factors?.[f])) dd.append(el("span", { class: "small muted", text: row.note }));
    dl.append(el("dt", { text: row.label }), dd);
  }
  const extra = [...new Set([...Object.keys(brief.factors || {}), ...Object.keys(brief.unavailable || {})])].filter((f) => !shown.has(f));
  if (extra.length) {
    dl.append(el("dt", { text: "其他構面" }), el("dd", {}, ...extra.map((f) => factorLine(f, brief.factors?.[f], brief.unavailable?.[f]))));
  }
  const fit = coolingFit(brief.factors, brief.constraints, FIT_RULES);
  fill(body, picked && picked.country === sel.country
    ? el("div", { class: "picked", "data-picked": picked.id }, el("h3", { text: "地圖點選的事件" }), eventCard(picked, { onPick })) : null,
    el("h3", { text: countryZh(sel.country) }), dl,
    fit.length ? el("ul", { class: "fit" }, ...fit.map((f) => el("li", {}, el("span", { text: f.text }), el("span", { class: "small muted", text: `依據：${f.basis}` })))) : null,
    sel.scenario ? aiBox(load, "策略分析（AI 判讀・附證據）", "strategy", { country: sel.country, scenario: sel.scenario }, strategyView) : null,
    el("h3", { text: `該國法規動態${sel.scenario ? `・${SCENARIO_ZH[sel.scenario]}` : ""}` }),
    regs.length ? el("div", { class: "list" }, ...regs.slice(0, 8).map((ev) => eventCard(ev, { compact: true, onPick })))
      : el("p", { class: "state empty", text: "這個國家（與場景）目前沒有抓到法規或標準。" }));
}
