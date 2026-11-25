// Labels (`07`)
export const SCENARIO_ZH = { "": "全部", "S-HEAT": "熱回收", "S-EFF": "節能高水溫", "S-EDGE": "邊緣戶外", "S-MIL": "軍事國防" };
export const CONSTRAINT_ZH = { grid_moratorium: "電網暫停令", grid_capacity: "電力容量受限", generation_expansion: "發電擴建",
  permitting: "許可／環評", water_restriction: "用水限制", heat_reuse_mandate: "熱回收義務", pue_cap: "PUE 上限" };
export const FORM_ZH = { container: "貨櫃式", modular: "模組化", building: "建築機房" };
export const DOC_ZH = { regulation: "法規", standard: "標準", deployment: "部署", case_study: "案例", product: "產品",
  tender: "標案", news: "新聞", whitepaper: "白皮書", reference_design: "參考設計", other: "其他" };
export const FACTOR_ZH = { water_stress: "水壓", grid_carbon_intensity: "電網碳強度", electricity_price: "電價",
  climate_heat_humidity: "高溫高濕", climate_drybulb_p04: "0.4% 乾球", climate_wetbulb_max: "極端濕球",
  climate_hdd18: "供暖度日", climate_freecool_w32_h: "W32 免冷機", climate_freecool_w45_h: "W45 免冷機" };
export const CLAIMANT_ZH = { vendor: "業者宣稱", customer: "客戶宣稱", third_party: "第三方" };

let names = null;
export function countryZh(iso) {
  if (!iso) return "";
  try {
    names = names || new Intl.DisplayNames(["zh-Hant-TW"], { type: "region" });
    const n = names.of(iso);
    return n && n !== iso ? n : iso;
  } catch { return iso; }
}

export function staleText(lastRunAt, now = Date.now()) {
  if (!lastRunAt) return "尚未跑過抓取";
  const t = Date.parse(lastRunAt);
  if (Number.isNaN(t)) return null;
  const h = (now - t) / 3600000;
  return h > 24 ? `資料停在 ${Math.round(h)} 小時前` : null;
}

// >26h (daily schedule, D-036) and not running → 請雙擊啟動器更新 (D-024)
export function updateHint(lastRunAt, running, now = Date.now()) {
  if (running) return null;
  if (!lastRunAt) return "請雙擊啟動器更新";
  const t = Date.parse(lastRunAt);
  if (Number.isNaN(t)) return null;
  return now - t > 26 * 3600000 ? "請雙擊啟動器更新" : null;
}

export function shortDate(iso) {
  return typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : "日期不明";
}

// D-019: 「約」 unless read from the page; missing → 「日期不明」
export function dateParts(iso, dateSource) {
  const known = typeof iso === "string" && iso.length >= 10;
  return { text: shortDate(iso), approx: known && dateSource !== "page" };
}

export function eventDateText(sources) {
  const ds = (sources || []).map((x) => x.published_at).filter((d) => typeof d === "string" && d.length >= 10).map((d) => d.slice(0, 10)).sort();
  if (ds.length > 1 && ds[0] !== ds[ds.length - 1]) return `首見 ${ds[0].slice(5)}・最新 ${ds[ds.length - 1].slice(5)}`;
  return null;
}
