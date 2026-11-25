// Snapshot copy of dashboard/config.js (WO-84): same exports; the page reads ./data/*.json, so API_BASE is a relative folder.
// tests/test_snapshot.py fails when the export names drift from dashboard/config.js.
export const API_BASE = ".";
export const TIMEOUT_MS = 10000;
export const SCENARIO_ORDER = ["", "S-HEAT", "S-EFF", "S-EDGE", "S-MIL"];
export const CELL_ROWS = 5; // 四格 newest 5 (`07` v0.6)
export const GLOBAL_ROWS = 8; // 條件欄 全球最新變動

export const SCENARIO_RULES = {
  "": [{ factor: "climate_freecool_w32_h", op: ">=", value: 6000, zh: "W32 免冷機時數" }],
  "S-HEAT": [{ factor: "climate_hdd18", op: ">=", value: 2000, zh: "供暖度日" }],
  "S-EFF": [{ factor: "climate_freecool_w32_h", op: ">=", value: 6000, zh: "W32 免冷機時數" },
    { factor: "water_stress", op: "<=", value: 2, zh: "水壓分數（0–5）" }],
  "S-EDGE": [{ factor: "climate_wetbulb_max", op: ">=", value: 26, zh: "極端濕球溫度" }],
  "S-MIL": [],
};

export const FIT_RULES = [
  { factor: "climate_freecool_w45_h", op: ">=", value: 8000, basisZh: "W45 免冷機時數", text: "W45 高水溫液冷幾乎全年免冷機" },
  { factor: "climate_freecool_w32_h", op: ">=", value: 6000, basisZh: "W32 免冷機時數", text: "W32 液冷大部分時間免冷機" },
  { factor: "water_stress", op: ">=", value: 3, basisZh: "水壓分數", text: "缺水：避開蒸發冷卻，偏乾式冷卻＋液冷" },
  { factor: "climate_wetbulb_max", op: ">=", value: 26, basisZh: "極端濕球溫度 °C", text: "濕球高：蒸發冷卻效益受限，密閉液冷較穩" },
  { factor: "climate_hdd18", op: ">=", value: 2500, basisZh: "供暖度日", text: "供暖需求高：熱回收有出路（熱回收場景）" },
  { constraint: "power", basisZh: "電力限制訊號", text: "電力受限：高密度液冷、能效優先" },
  { constraint: "heat_reuse_mandate", basisZh: "熱回收義務訊號", text: "有熱回收義務：設計需預留餘熱出口" },
  { constraint: "permitting", basisZh: "許可／環評訊號", text: "許可／環評有動態：時程風險" },
];
