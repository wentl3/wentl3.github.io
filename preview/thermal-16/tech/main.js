// Boot of tech.html; `#smoke` runs the browser smoke (ops/ui_smoke.sh, SMOKE_PAGE=tech)
import { mountTech } from "./app.js";

const $ = (id) => document.getElementById(id);
const page = mountTech({ main: $("tech-main"), header: $("tech-header"), products: $("tech-products"), matrix: $("tech-matrix"), trend: $("tech-trend"), assoc: $("tech-assoc") }, {
  search: location.search,
  save: (q) => { try { history.replaceState(null, "", `${location.pathname}${q}${location.hash}`); } catch { /* file:// */ } },
});
if (location.hash.startsWith("#smoke")) page.ready.then(() => import("./smoke.js")).then((m) => m.runSmoke());
