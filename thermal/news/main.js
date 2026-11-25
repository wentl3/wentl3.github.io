// Boot of news.html
import { mountNews } from "./app.js";

const $ = (id) => document.getElementById(id);
mountNews({ header: $("news-header"), channels: $("news-channels"), top: $("news-top"), conf: $("news-conf"), immersion: $("news-immersion"), policy: $("news-policy"), assoc: $("news-assoc"), pfas: $("news-pfas"), evidence: $("news-evidence") }, {
  search: location.search,
  save: (q) => { try { history.replaceState(null, "", `${location.pathname}${q}${location.hash}`); } catch { /* file:// */ } },
});
