// `07` E-01／E-08, D-014: base layer, bivariate cross, threshold filter
import { fillFor } from "./counts.js";

export const LAYERS = [
  { id: "policy", zh: "政策動向", kind: "count", group: "signals", events: "reg", bivar: true },
  { id: "water", zh: "水資源壓力", kind: "band", group: "conditions", factor: "water_stress", unit: "0–5", bivar: true },
  { id: "deploy", zh: "已查到部署", kind: "count", group: "signals", events: "deploy", bivar: true },
  { id: "fc32", zh: "W32 免冷機時數", kind: "numeric", group: "conditions", factor: "climate_freecool_w32_h", unit: "h／年", bivar: true },
  { id: "fc45", zh: "W45 免冷機時數", kind: "numeric", group: "conditions", factor: "climate_freecool_w45_h", unit: "h／年", bivar: true },
  { id: "wbmax", zh: "極端濕球溫度", kind: "numeric", group: "conditions", factor: "climate_wetbulb_max", unit: "°C", bivar: true },
  { id: "db04", zh: "0.4% 乾球溫度", kind: "numeric", group: "conditions", factor: "climate_drybulb_p04", unit: "°C", bivar: true },
  { id: "hdd", zh: "供暖度日", kind: "numeric", group: "conditions", factor: "climate_hdd18", unit: "°C·日", bivar: true },
  { id: "renew", zh: "再生電力占比", kind: "numeric", group: "conditions", factor: "energy_renewable_share", unit: "%", bivar: true },
  { id: "access", zh: "電力普及率", kind: "numeric", group: "conditions", factor: "energy_access", unit: "%", bivar: true },
  { id: "rs_heat", zh: "法規結構：熱回收義務", kind: "reg", group: "reg", key: "heat" },
  { id: "rs_pue", zh: "法規結構：PUE／能效上限", kind: "reg", group: "reg", key: "pue" },
  { id: "rs_grid", zh: "法規結構：暫停令／電網限制", kind: "reg", group: "reg", key: "grid" },
  { id: "rs_water", zh: "法規結構：用水限制", kind: "reg", group: "reg", key: "water" },
];
export const LAYER_GROUPS = [{ id: "conditions", zh: "條件" }, { id: "signals", zh: "訊號" }, { id: "reg", zh: "法規結構" }];
const COUNT_CUTS = [1, 2]; // F1: 0／1／≥2, never terciles
const REG_STAGE = { proposed: ["n1", "提案中"], consultation: ["n1", "徵詢中"], passed: ["n2", "已通過"], signed: ["n2", "已簽署"],
  in_force: ["n3", "已生效"], rejected: ["n0", "遭否決"], announced: ["n1", "已宣布"], unknown: ["n0", "有事件、狀態未明"] };
export const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
export const BIVAR_LAYERS = LAYERS.filter((l) => l.bivar).map((l) => l.id);
export const ESTIMATE_NOTE = "NASA POWER 單點推算・非 ASHRAE 設計值";

export function layerValue(entry, layerId) {
  const l = LAYER_BY_ID[layerId];
  if (!l) return null;
  if (l.kind === "count") return typeof entry?.events?.[l.events] === "number" ? entry.events[l.events] : null;
  return factorValue(entry, l.factor);
}

export function factorValue(entry, factor) {
  const v = entry?.factors?.[factor]?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function quantileCuts(values, k) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [];
  const cuts = [];
  for (let i = 1; i < k; i++) cuts.push(v[Math.min(v.length - 1, Math.floor((i * v.length) / k))]);
  return cuts;
}

export function classOf(value, cuts) {
  let i = 0;
  while (i < cuts.length && value >= cuts[i]) i++;
  return i;
}

export function layerCuts(countries, k) {
  const out = {};
  for (const l of LAYERS) if (l.factor) out[l.id] = quantileCuts(Object.values(countries || {}).map((e) => factorValue(e, l.factor)), k);
  for (const l of LAYERS) if (l.kind === "count") out[l.id] = COUNT_CUTS;
  return out;
}

const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 10) / 10));

export function fillForLayer(entry, layerId, cuts4) {
  const l = LAYER_BY_ID[layerId] || LAYER_BY_ID.policy;
  if (l.kind === "reg") {
    if (!entry) return { cls: "land", label: "未調研" };
    const st = entry.events?.reg_structure?.[l.key];
    if (!st) return { cls: "hatch", label: `${l.zh}：未查到（不代表沒有此法規）` };
    const [cls, zh] = REG_STAGE[st] || REG_STAGE.unknown;
    return { cls, label: `${l.zh}：${zh}（最新法規事件；國家共 ${entry.events.reg} 件法規事件）` };
  }
  if (l.kind !== "numeric") return fillFor(entry, l.id);
  if (!entry) return { cls: "land", label: "未調研" };
  const v = factorValue(entry, l.factor);
  if (v === null) return { cls: "hatch", label: `${l.zh}未取得` };
  const point = entry.factors[l.factor].point;
  return { cls: `n${classOf(v, cuts4[l.id] || [])}`, label: `${l.zh} ${fmt(v)} ${l.unit}${point ? `（代表點 ${point}）` : ""}` };
}

export function bivariateClass(entry, a, b, cuts3) {
  const va = layerValue(entry, a), vb = layerValue(entry, b);
  if (va === null || vb === null) return null;
  return `b${classOf(va, cuts3[a] || [])}${classOf(vb, cuts3[b] || [])}`;
}

export function cutsText(layerId, cuts) {
  const l = LAYER_BY_ID[layerId];
  if (l?.kind === "count") return `${l.zh}（事件數）：0／1／≥2 件（固定分級，非三分位）`;
  if (!l || cuts.length < 2) return `${l ? l.zh : layerId}：資料不足以分級`;
  return `${l.zh}：低 < ${fmt(cuts[0])} ≤ 中 < ${fmt(cuts[1])} ≤ 高（${l.unit}）`;
}

const OPS = { ">=": (a, b) => a >= b, "<=": (a, b) => a <= b };

export function matchesRule(entry, rule) {
  if (!rule || !rule.length) return null;
  for (const c of rule) {
    const v = factorValue(entry, c.factor);
    if (v === null) return null;
    if (!OPS[c.op](v, c.value)) return false;
  }
  return true;
}

export function ruleStats(countries, rule) {
  let match = 0, withData = 0;
  for (const e of Object.values(countries || {})) {
    const m = matchesRule(e, rule);
    if (m === null) continue;
    withData += 1;
    if (m) match += 1;
  }
  return { match, withData };
}

const CONSTRAINT_POWER = new Set(["grid_moratorium", "grid_capacity", "generation_expansion"]);

// 散熱適配 (`07` E-03): each line names its basis; no total score (D-014)
export function coolingFit(factors, constraints, rules) {
  const out = [];
  for (const r of rules) {
    if (r.constraint) {
      const n = Object.entries(constraints || {}).filter(([t]) => (r.constraint === "power" ? CONSTRAINT_POWER.has(t) : t === r.constraint))
        .reduce((s, [, k]) => s + k, 0);
      if (n > 0) out.push({ text: r.text, basis: `${r.basisZh} ${n} 則（新聞抽取，附引文）` });
      continue;
    }
    const v = typeof factors?.[r.factor]?.value === "number" ? factors[r.factor].value : null;
    if (v !== null && OPS[r.op](v, r.value)) out.push({ text: r.text, basis: `${r.basisZh} ${fmt(v)} ${r.op === ">=" ? "≥" : "≤"} ${fmt(r.value)}（假設門檻）` });
  }
  return out;
}

// D-020 tooltip: numeric cites dataset, count says how many to open
export function layerTip(countryZh, layerId, label, entry) {
  const l = LAYER_BY_ID[layerId];
  if (!entry) return `${countryZh}：${label}・無資料`;
  if (l?.kind === "count") return `${countryZh}：${label}・點開看 ${entry.events?.[l.events] ?? 0} 件`;
  if (l?.kind === "reg") return `${countryZh}：${label}・點開看 ${entry.events?.reg ?? 0} 件法規事件`;
  const ds = entry.factors?.[l?.factor]?.dataset;
  return `${countryZh}：${label}・${ds || "來源：無資料"}`;
}
