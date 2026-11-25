// Map counts per mode (`07` E-01)

export const EU_MEMBERS = new Set(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);

export const MODE_DOC_TYPES = {
  policy: ["regulation", "standard"],
  deploy: ["deployment", "case_study"],
};

const BANDS = [
  [/extremely high/i, "w4", "水壓極高"],
  [/^high|high \(40/i, "w3", "水壓高"],
  [/medium - high/i, "w2", "水壓中高"],
  [/low - medium/i, "w1", "水壓中低"],
  [/^low/i, "w0", "水壓低"],
];

export function waterBand(band) {
  if (typeof band === "string") {
    for (const [re, cls, zh] of BANDS) if (re.test(band)) return { cls, zh };
  }
  return { cls: null, zh: "未取得" };
}

export function modeCount(counts, mode) {
  const out = { accepted: 0, unverified: 0 };
  for (const t of MODE_DOC_TYPES[mode] || []) {
    const c = (counts || {})[t];
    if (c) { out.accepted += c.accepted || 0; out.unverified += c.unverified || 0; }
  }
  return out;
}

export function totalCount(counts) {
  const out = { accepted: 0, unverified: 0 };
  for (const c of Object.values(counts || {})) { out.accepted += c.accepted || 0; out.unverified += c.unverified || 0; }
  return out;
}

export function fillFor(entry, mode) {
  if (!entry) return { cls: "land", label: "未調研" };
  if (mode === "water") {
    const w = waterBand(entry.factors?.water_stress?.band);
    return w.cls ? { cls: w.cls, label: w.zh } : { cls: "hatch", label: "水壓未取得" };
  }
  const c = modeCount(entry.counts, mode);
  const n = c.accepted + c.unverified;
  const what = mode === "policy" ? "法規／標準" : "部署／案例";
  const t = totalCount(entry.counts);
  if (n === 0 && t.accepted + t.unverified === 0) return { cls: "land", label: "尚無情報" }; // 未調研 = 底色
  if (n === 0) return { cls: "hatch", label: `有情報但查無${what}` };
  return { cls: `r${Math.min(n, 4)}`, label: `${what} ${n} 則${c.unverified ? `（含未驗證 ${c.unverified}）` : ""}` };
}

export function expandCountries(codes) {
  const out = [];
  for (const c of codes || []) {
    if (c === "EU") for (const m of EU_MEMBERS) out.push(m);
    else if (/^[A-Z]{2}$/.test(c) && c !== "ZZ") out.push(c);
  }
  return out;
}

export const LEGEND = {
  policy: "法規／標準筆數：深＝多（1–4+）・斜線＝有情報但查無法規・底色＝尚無情報・空心點＝含未驗證",
  water: "WRI Aqueduct 水壓：綠＝低 → 紅＝極高・斜線＝未取得",
  deploy: "部署／案例筆數：深＝多（1–4+）・斜線＝有情報但查無部署・底色＝尚無情報・空心點＝含未驗證",
};
