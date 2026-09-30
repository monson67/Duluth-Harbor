// Sunrise, sunset and moon phase, calculated locally (no internet needed).

const rad = Math.PI / 180;

// Returns sun times for the given date and place, using the standard
// NOAA / "sunrise equation" approximation (accurate to about a minute).
export function sunTimes(date, lat, lon) {
  const J2000 = 2451545;
  const julian = date.getTime() / 86400000 + 2440587.5;
  const n = Math.round(julian - J2000 + 0.0008 + lon / 360); // lon is negative west
  const Jstar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jtransit = J2000 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const decl = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const toDate = (j) => new Date((j - 2440587.5) * 86400000);
  const at = (altDeg) => {
    const cosH = (Math.sin(altDeg * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
    if (cosH < -1 || cosH > 1) return [null, null];
    const H = Math.acos(cosH) / rad;
    return [toDate(Jtransit - H / 360), toDate(Jtransit + H / 360)];
  };
  const [sunrise, sunset] = at(-0.833);
  const [dawn, dusk] = at(-6);
  const [goldenEnd, goldenStart] = at(6);
  return { sunrise, sunset, dawn, dusk, goldenEnd, goldenStart, noon: toDate(Jtransit) };
}

export function moonPhase(date) {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((date.getTime() - knownNew) / 86400000) % synodic + synodic) % synodic;
  const illum = (1 - Math.cos((2 * Math.PI * age) / synodic)) / 2;
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  const icons = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  const idx = Math.round((age / synodic) * 8) % 8;
  const daysToFull = ((synodic / 2 - age) + synodic) % synodic;
  return { age, illum, name: names[idx], icon: icons[idx], daysToFull };
}

// Moon position (low-precision formulas, good to a few minutes for rise/set).
function moonAltitude(date, lat, lon) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545;
  const L = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, F = 93.272 + 13.22935 * d;
  const eLon = (L + 6.289 * Math.sin(M * rad)) * rad;
  const eLat = 5.128 * Math.sin(F * rad) * rad;
  const e = 23.4397 * rad;
  const ra = Math.atan2(Math.sin(eLon) * Math.cos(e) - Math.tan(eLat) * Math.sin(e), Math.cos(eLon));
  const dec = Math.asin(Math.sin(eLat) * Math.cos(e) + Math.cos(eLat) * Math.sin(e) * Math.sin(eLon));
  const sidereal = (280.16 + 360.9856235 * d + lon) * rad;
  const H = sidereal - ra;
  return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(H)) / rad;
}

// Next moonrise and moonset after `from`, searching up to 36 hours ahead.
export function moonTimes(from, lat, lon) {
  const h0 = 0.133, step = 10 * 60000;
  let rise = null, set = null;
  let t = from.getTime(), prev = moonAltitude(from, lat, lon) - h0;
  for (let i = 0; i < 216 && !(rise && set); i++) {
    const t2 = t + step, cur = moonAltitude(new Date(t2), lat, lon) - h0;
    if (prev < 0 && cur >= 0 && !rise) rise = new Date(t + (step * -prev) / (cur - prev));
    if (prev >= 0 && cur < 0 && !set) set = new Date(t + (step * prev) / (prev - cur));
    t = t2; prev = cur;
  }
  return { rise, set };
}
