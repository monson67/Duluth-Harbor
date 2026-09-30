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
