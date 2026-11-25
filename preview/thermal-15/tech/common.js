// Shared by the 第二頁 (`07` D-029): URL params, labels, row layout. Pure; no DOM.
export const WINDOWS = [30, 90, 365];
export const COOLINGS = ["Air", "DLC", "1PIC", "2PIC"];
export const DEFAULTS = { days: 90, cool: "", conf: "" };
export const VENDOR_CAP = 3; // `03` §1f: the API already caps; a longer list is still shown as 3 + 另 N 則
export const MATRIX_ROWS = 15; // H-03
export const COOL_ZH = { "": "全部", Air: "氣冷 Air", DLC: "DLC", "1PIC": "單相浸沒 1PIC", "2PIC": "雙相浸沒 2PIC", Hybrid_Jet: "Hybrid Jet", Other: "其他" };
export const ACTION_ZH = { launch: "發表", new_support: "新增支援", certified: "取得認證", shipping: "開始出貨", reference_design: "參考設計", standard_release: "標準發布", showcase: "展會展示" };

export const TREND = [["Air", "Air"], ["DLC_cold_plate", "DLC・冷板"], ["DLC_other", "DLC・其他直接"], ["DLC_unspecified", "DLC 未註明"], ["1PIC", "1PIC"], ["2PIC", "2PIC"], ["Other", "其他"]];
export const coolLabel = (r) => (r.cooling === "DLC" && r.dlc_subtype === "cold_plate" ? "DLC・冷板" : r.cooling === "DLC" && r.dlc_subtype === "other_direct" ? "DLC・其他直接" : COOL_ZH[r.cooling] || r.cooling);
/** `date` in the week starting `start` (UTC Monday)? */
export const inWeek = (date, start) => { const t = Date.parse(date), s = Date.parse(`${start}T00:00:00Z`); return t >= s && t < s + 6048e5; };

/** Same key as the API's model_key: lower case, whitespace and hyphens removed. */
export const modelKey = (m) => String(m || "").toLowerCase().replace(/[\s-]+/g, "");
export const rowKey = (r) => `${r.vendor}|${modelKey(r.model)}|${r.cooling}`;

/** `?h_days=&h_cool=&h_conf=` → state; values outside the lists fall back to the default. `ids` = API conference ids when known (else shape only; the page drops an unknown id on API 400). */
export function parseTech(search, ids) {
  let q;
  try { q = new URLSearchParams(search || ""); } catch { return { ...DEFAULTS }; }
  const d = q.get("h_days"), c = q.get("h_cool"), f = q.get("h_conf");
  return { days: WINDOWS.map(String).includes(d) ? Number(d) : DEFAULTS.days, cool: COOLINGS.includes(c) ? c : DEFAULTS.cool,
    conf: ids ? (ids.includes(f) ? f : "") : /^[\w.-]{1,64}$/.test(f || "") ? f : "" };
}

/** State → query string; defaults are left out. */
export function techQuery({ days, cool, conf }) {
  const q = new URLSearchParams();
  if (days !== DEFAULTS.days) q.set("h_days", days);
  if (cool && cool !== DEFAULTS.cool) q.set("h_cool", cool);
  if (conf) q.set("h_conf", conf);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** `/products` query; with a conference `days` is not sent. */
export const productsParams = ({ days, cool, conf }) => (conf ? { cooling: cool, conf } : { days, cooling: cool });
export const confSpan = (c) => `展會期間 ${c.start}～${c.end}（前 3 天、後 7 天）`;

/** API rows (newest first) → table entries `{row}`／`{more: vendor, n}`: ≤ 3 rows per vendor (extras count into 另 N 則),
 *  the 另 N 則 line sits under that vendor's last shown row. */
export function layoutRows(rows, more = {}) {
  const seen = {}, extra = { ...more }, kept = [], last = {};
  for (const r of rows) {
    seen[r.vendor] = (seen[r.vendor] || 0) + 1;
    if (seen[r.vendor] > VENDOR_CAP) { extra[r.vendor] = (extra[r.vendor] || 0) + 1; continue; }
    last[r.vendor] = kept.push({ row: r }) - 1;
  }
  const out = [];
  kept.forEach((e, i) => { out.push(e); if (last[e.row.vendor] === i && extra[e.row.vendor]) out.push({ more: e.row.vendor, n: extra[e.row.vendor] }); });
  for (const v of Object.keys(extra)) if (!(v in last) && extra[v]) out.push({ more: v, n: extra[v] });
  return out;
}

/** A 404 here means an API older than WO-49 (no /products): say so instead of a bare status. */
export function describe(e) {
  return e && e.kind === "error" && /\b404\b/.test(e.message || "")
    ? Object.assign(new Error(`${e.message}（這支 Pipeline 沒有產品整理，請更新後重新啟動）`), { kind: "error" }) : e;
}
