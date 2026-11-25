// Shared by the 新聞頁 (`07` D-036): URL param, labels, row helpers. Pure; no DOM.
export const WINDOWS = [7, 30];
export const DEFAULT_DAYS = 7;
export const CHANNEL_ORDER = ["immersion", "liquid", "deploy", "mdc", "platform", "silicon", "policy"]; // N-02 固定欄序（D-037 七欄）
export const CHANNEL_CAP = 5; // N-02 未展開時每欄最多
export const VENDOR_CAP = 3; // N-03
export const PFAS_CAP = 20; // N-06
export const TOPIC_ZH = { pue: "PUE／能效", heat_reuse: "熱回收", moratorium: "暫停接電", pfas: "PFAS" };
export const TOPICS = ["", "pue", "heat_reuse", "moratorium", "pfas"]; // N-04 議題篩選（空＝全部）
export const CONF_CAP = 10; // N-07
export const TOP_CAP = 5; // N-08
export const EVIDENCE_FILTERS = [["", "全部"], ["neocloud", "neocloud"], ["mdc", "MDC"]]; // N-09 部署篩選
export const winWord = (days) => (days === 30 ? "近 30 天" : "本週");

/** `?n_days=` → 7|30; anything else → 7. */
export function parseNews(search) {
  let d = null;
  try { d = new URLSearchParams(search || "").get("n_days"); } catch { /* bad search */ }
  return { days: WINDOWS.map(String).includes(d) ? Number(d) : DEFAULT_DAYS };
}
/** State → query string; the default is left out. */
export function newsQuery({ days }) {
  return days !== DEFAULT_DAYS ? `?n_days=${days}` : "";
}

/** Date text of one headline: 「約」 unless read from the page; missing → 日期不明. */
export function dateText(date, source) {
  const known = typeof date === "string" && date.length >= 10;
  return known ? `${source === "page" ? "" : "約 "}${date.slice(0, 10)}` : "日期不明";
}
/** One list row's date (D-037): published_at present → dateText; published_at null → 「日期未知（首見 MM-DD）」. Rows without the key fall back to dateText. */
export function itemDate(it) {
  if (it && "published_at" in it && !it.published_at) {
    const f = text(it.first_seen) || text(it.date);
    return /^\d{4}-\d{2}-\d{2}/.test(f) ? `日期未知（首見 ${f.slice(5, 10)}）` : "日期未知";
  }
  return dateText(it && it.date, it && it.date_source);
}
/** Week-over-week text: 「本週 N（上週 M，±x）」; missing/bad `week` → null (no comparison shown). */
export function weekText(w) {
  if (!w || ![w.this, w.last, w.delta].every(Number.isFinite)) return null;
  const d = w.delta > 0 ? `+${w.delta}` : w.delta < 0 ? `-${-w.delta}` : "±0";
  return `本週 ${w.this}（上週 ${w.last}，${d}）`;
}
/** `/meta` last_run_at → whole days behind when > 2 days, else null (REQ-N1). */
export function lagDays(lastRunAt, now = Date.now()) {
  const t = Date.parse(lastRunAt);
  if (Number.isNaN(t)) return null;
  const d = (now - t) / 864e5;
  return d > 2 ? Math.floor(d) : null;
}
export const arr = (x) => (Array.isArray(x) ? x : []);
export const text = (x) => (typeof x === "string" ? x : "");

/** A 404 means a Pipeline older than WO-85 (no /news). */
export function describe(e) {
  return e && e.kind === "error" && /\b404\b/.test(e.message || "")
    ? Object.assign(new Error(`${e.message}（這支 Pipeline 沒有新聞層，請更新後重新啟動）`), { kind: "error" }) : e;
}
