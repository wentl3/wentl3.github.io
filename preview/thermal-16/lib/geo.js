// Country geometry helpers (pure, no d3)

/** ISO numeric ("276") → alpha-2 ("DE"), from vendor/iso-numeric.json ({ "276": "DE", … }). */
export function numericToAlpha2(table) {
  const out = new Map();
  for (const [num, a2] of Object.entries(table || {})) out.set(String(num).padStart(3, "0"), a2);
  return out;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

/**
 * Mainland polygon of a (Multi)Polygon: the one with the largest outer ring.
 * The dot sits on it, so France is not pulled into the Atlantic by French Guiana (V-023).
 */
export function largestPolygon(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon") return geometry;
  if (geometry.type !== "MultiPolygon") return null;
  let best = null;
  let bestArea = -1;
  for (const coords of geometry.coordinates) {
    const a = ringArea(coords[0]);
    if (a > bestArea) { bestArea = a; best = coords; }
  }
  return best ? { type: "Polygon", coordinates: best } : null;
}
