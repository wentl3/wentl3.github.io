// Selection ↔ share-link params (t_*). `07` v0.6 §1: t_tab retired (ignored)
import { BIVAR_LAYERS, LAYERS } from "./layers.js";

export const MODES = LAYERS.map((l) => l.id); // t_mode: base layer id; v0.5 values policy／water／deploy still valid
export const SCENARIOS = ["S-HEAT", "S-EFF", "S-EDGE", "S-MIL"];
export const FOCUSES = ["tech", "market", "site_policy", "all"]; // D-018 news lens; tech (技術・產品) is the default
export const DEFAULTS = { country: "", vendor: "", mode: "policy", scenario: "", hub: "", x: "", filt: "", focus: "tech" };
const P = { country: "t_country", vendor: "t_vendor", mode: "t_mode", scenario: "t_scen", hub: "t_hub", x: "t_x", filt: "t_filt", focus: "t_focus" };

export function parseSelection(search) {
  const out = {};
  let q;
  try { q = new URLSearchParams(search || ""); } catch { return out; }
  const c = (q.get(P.country) || "").toUpperCase();
  if (/^[A-Z]{2}$/.test(c)) out.country = c;
  const v = (q.get(P.vendor) || "").trim();
  if (v && v.length <= 60) out.vendor = v;
  const m = q.get(P.mode);
  if (MODES.includes(m)) out.mode = m;
  const s = q.get(P.scenario);
  if (SCENARIOS.includes(s)) out.scenario = s;
  const h = q.get(P.hub);
  if (/^H-[A-Z]{3}$/.test(h || "")) out.hub = h;
  const x = q.get(P.x);
  if (BIVAR_LAYERS.includes(x)) out.x = x;
  if (q.get(P.filt) === "1") out.filt = "1";
  const f = q.get(P.focus);
  if (FOCUSES.includes(f)) out.focus = f;
  return out;
}

/** Selection → query string; defaults are left out so a plain link stays plain. */
export function selectionQuery(sel) {
  const q = new URLSearchParams();
  for (const [k, name] of Object.entries(P)) {
    if (sel[k] && sel[k] !== DEFAULTS[k]) q.set(name, sel[k]);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
