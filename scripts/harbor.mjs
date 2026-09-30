// Harbor geography and ship-tracking logic (no network access here, so it
// can be tested on its own). Used by scripts/update-data.mjs.

export const ENTRIES = {
  duluth: { key: "duluth", name: "Duluth Ship Canal", lat: 46.7790, lon: -92.0926 },
  superior: { key: "superior", name: "Superior Entry", lat: 46.7105, lon: -92.0090 },
};

// Rough outline of the Duluth-Superior harbor (St. Louis Bay, Superior Bay,
// Allouez Bay). Anything inside is "harbor"; anything outside is "lake".
// The lake-side edge follows Minnesota Point and Wisconsin Point.
export const HARBOR_POLYGON = [
  [46.7790, -92.0926], // Aerial Lift Bridge
  [46.7105, -92.0090], // Superior Entry
  [46.6900, -91.9650], // end of Wisconsin Point
  [46.6750, -91.9850],
  [46.6800, -92.0500],
  [46.7000, -92.1000],
  [46.7200, -92.1700],
  [46.7450, -92.2100],
  [46.7650, -92.1700],
  [46.7800, -92.1300],
  [46.7950, -92.1050],
  [46.7880, -92.0950],
];

// Area watched for AIS messages: the harbor plus the western end of Lake
// Superior (out past the Apostle Islands and up the North Shore), so ships
// show up hours before they reach the canal.
export const WATCH_BOX = [[46.40, -92.35], [47.75, -90.20]];

// Destinations that mean "coming to the Twin Ports".
const TWIN_PORTS = /DULUTH|SUPERIOR|DLH|USDLH|SUW|USSUW|TWIN ?PORT/i;

export function inHarbor(lat, lon) {
  let inside = false;
  const p = HARBOR_POLYGON;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [yi, xi] = p[i], [yj, xj] = p[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const R_NM = 3440.065; // Earth radius in nautical miles
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function distanceNm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.sqrt(a));
}

export function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

export function nearestEntry(lat, lon) {
  let best = null;
  for (const e of Object.values(ENTRIES)) {
    const d = distanceNm(lat, lon, e.lat, e.lon);
    if (!best || d < best.distanceNm) best = { entry: e, distanceNm: d };
  }
  return best;
}

// AIS ship type codes -> plain names.
export function typeName(code) {
  if (code == null) return "Unknown";
  if (code >= 70 && code <= 79) return "Cargo";
  if (code >= 80 && code <= 89) return "Tanker";
  if (code >= 60 && code <= 69) return "Passenger";
  if (code === 31 || code === 32 || code === 52) return "Tug";
  if (code === 30) return "Fishing";
  if (code === 33) return "Dredger";
  if (code === 35) return "Military";
  if (code === 36) return "Sailboat";
  if (code === 37) return "Pleasure craft";
  if (code === 50) return "Pilot";
  if (code === 51) return "Search & rescue";
  if (code === 55) return "Law enforcement";
  if (code >= 40 && code <= 49) return "High-speed craft";
  return "Other";
}

// Big commercial traffic we care about (freighters, tankers, tugs, cruise).
export function isCommercial(v) {
  const t = v.type;
  if (t == null) return (v.length || 0) >= 60;
  return (t >= 60 && t <= 89) || t === 31 || t === 32 || t === 52 || t === 33 || (v.length || 0) >= 60;
}

const NAV_STATUS = {
  0: "Underway", 1: "At anchor", 2: "Not under command", 3: "Restricted maneuverability",
  5: "Moored", 6: "Aground", 8: "Underway (sailing)",
};

const clean = (s) => (typeof s === "string" ? s.replace(/@+/g, "").trim() : s) || undefined;

// Apply one aisstream.io message to the vessel map.
export function applyMessage(vessels, msg, nowIso) {
  const meta = msg.MetaData || {};
  const mmsi = String(meta.MMSI || "");
  if (!mmsi) return;
  const v = vessels[mmsi] || (vessels[mmsi] = { mmsi });
  const name = clean(meta.ShipName);
  if (name) v.name = name;
  const body = msg.Message || {};

  const pos = body.PositionReport || body.StandardClassBPositionReport || body.ExtendedClassBPositionReport;
  if (pos) {
    v.lat = pos.Latitude ?? meta.latitude;
    v.lon = pos.Longitude ?? meta.longitude;
    v.sog = pos.Sog;
    v.cog = pos.Cog;
    if (pos.TrueHeading != null && pos.TrueHeading !== 511) v.heading = pos.TrueHeading;
    if (pos.NavigationalStatus != null) v.navStatus = pos.NavigationalStatus;
    v.lastSeen = nowIso;
  }

  const st = body.ShipStaticData;
  if (st) {
    if (clean(st.Name)) v.name = clean(st.Name);
    if (st.ImoNumber) v.imo = st.ImoNumber;
    if (clean(st.CallSign)) v.callsign = clean(st.CallSign);
    if (st.Type != null) v.type = st.Type;
    const d = st.Dimension;
    if (d && d.A + d.B > 0) { v.length = d.A + d.B; v.beam = d.C + d.D; }
    if (st.MaximumStaticDraught) v.draught = st.MaximumStaticDraught;
    if (clean(st.Destination)) v.destination = clean(st.Destination);
    const e = st.Eta;
    if (e && e.Month && e.Day) v.aisEta = { month: e.Month, day: e.Day, hour: e.Hour, minute: e.Minute };
  }
  const sd = body.StaticDataReport;
  if (sd) {
    if (sd.ReportA && clean(sd.ReportA.Name)) v.name = clean(sd.ReportA.Name);
    if (sd.ReportB) {
      if (sd.ReportB.ShipType != null) v.type = sd.ReportB.ShipType;
      const d = sd.ReportB.Dimension;
      if (d && d.A + d.B > 0) { v.length = d.A + d.B; v.beam = d.C + d.D; }
    }
  }
}

// Work out where each vessel is and what it's doing.
export function describe(v) {
  if (v.lat == null || v.lon == null) return v;
  v.zone = inHarbor(v.lat, v.lon) ? "harbor" : "lake";
  v.typeName = typeName(v.type);
  const near = nearestEntry(v.lat, v.lon);
  v.nearestEntry = near.entry.key;
  v.distanceNm = +near.distanceNm.toFixed(2);
  v.canalDistanceNm = +distanceNm(v.lat, v.lon, ENTRIES.duluth.lat, ENTRIES.duluth.lon).toFixed(2);
  delete v.etaMinutes;
  delete v.approachEntry;
  delete v.departEntry;

  const moving = (v.sog || 0) >= 1.5;
  const anchored = v.navStatus === 1 || (!moving && v.zone === "lake");
  const moored = v.navStatus === 5 || (!moving && v.zone === "harbor");

  if (v.zone === "lake" && moving && v.cog != null) {
    // Heading toward one of the two entries? Close in, the course must point
    // at the entry. Farther out, accept a looser course if the ship reports
    // Duluth/Superior as its destination.
    const bound = TWIN_PORTS.test(v.destination || "");
    let best = null;
    for (const e of Object.values(ENTRIES)) {
      const d = distanceNm(v.lat, v.lon, e.lat, e.lon);
      const off = angleDiff(v.cog, bearing(v.lat, v.lon, e.lat, e.lon));
      const ok = (d <= 30 && off <= 30) || (bound && d <= 90 && off <= 45);
      if (ok && (!best || off < best.off)) best = { e, d, off };
    }
    if (best) {
      v.approachEntry = best.e.key;
      v.etaMinutes = Math.round((best.d / Math.max(v.sog, 0.5)) * 60);
    }
  }
  if (v.zone === "harbor" && (v.sog || 0) >= 2 && v.cog != null) {
    // Moving in the harbor and pointed at an entry = on the way out.
    for (const e of Object.values(ENTRIES)) {
      const d = distanceNm(v.lat, v.lon, e.lat, e.lon);
      if (d <= 3 && angleDiff(v.cog, bearing(v.lat, v.lon, e.lat, e.lon)) <= 35) {
        v.departEntry = e.key;
        v.etaMinutes = Math.round((d / v.sog) * 60);
        break;
      }
    }
  }

  if (v.approachEntry) v.status = `Approaching ${ENTRIES[v.approachEntry].name}`;
  else if (v.departEntry) v.status = `Heading out the ${ENTRIES[v.departEntry].name}`;
  else if (v.zone === "lake" && anchored) v.status = "At anchor off Duluth";
  else if (v.zone === "lake") v.status = "Underway on the lake";
  else if (moored) v.status = "At dock in harbor";
  else v.status = "Underway in harbor";
  if (NAV_STATUS[v.navStatus]) v.aisStatus = NAV_STATUS[v.navStatus];
  return v;
}

// Compare previous and current positions and produce events:
// approaching, arrived, departing (heading for an entry), departed.
export function detectEvents(prev, v, nowIso) {
  const events = [];
  if (!isCommercial(v) || v.lat == null) return events;
  const base = { mmsi: v.mmsi, name: v.name || `MMSI ${v.mmsi}`, time: nowIso, typeName: v.typeName, length: v.length };
  v.flags = { ...(prev?.flags || {}) };

  if (prev?.zone && prev.zone !== v.zone) {
    // Crossed through an entry. Which one? The nearest to the midpoint.
    const mid = nearestEntry((prev.lat + v.lat) / 2, (prev.lon + v.lon) / 2);
    const type = v.zone === "harbor" ? "arrived" : "departed";
    events.push({ ...base, type, entry: mid.entry.key });
    v.flags = {}; // new trip
    if (mid.entry.key === "duluth") v.lastCanalPassage = { time: nowIso, direction: type === "arrived" ? "inbound" : "outbound" };
  }

  if (v.approachEntry && v.etaMinutes <= 90 && !v.flags.approachAlerted) {
    events.push({ ...base, type: "approaching", entry: v.approachEntry, etaMinutes: v.etaMinutes });
    v.flags.approachAlerted = true;
  }

  if (v.departEntry && !v.flags.departAlerted) {
    events.push({ ...base, type: "departing", entry: v.departEntry, etaMinutes: v.etaMinutes });
    v.flags.departAlerted = true;
  }
  if (v.zone === "lake" && !v.approachEntry && v.distanceNm > 12) v.flags.approachAlerted = false;
  return events;
}

export function eventText(e) {
  const where = ENTRIES[e.entry]?.name || "the harbor";
  const size = e.length ? ` (${Math.round(e.length * 3.281)} ft ${e.typeName?.toLowerCase() || "vessel"})` : "";
  switch (e.type) {
    case "approaching": return { title: `🚢 ${e.name} approaching`, body: `${e.name}${size} is heading for the ${where}, about ${e.etaMinutes} min out.` };
    case "departing": return { title: `⚓ ${e.name} departing`, body: `${e.name}${size} is heading out through the ${where}${e.etaMinutes != null ? `, about ${e.etaMinutes} min away` : ""}.` };
    case "arrived": return { title: `✅ ${e.name} arrived`, body: `${e.name}${size} came in through the ${where}.` };
    case "departed": return { title: `👋 ${e.name} departed`, body: `${e.name}${size} left through the ${where}.` };
    default: return { title: e.name, body: e.type };
  }
}

// Does an event match a favorites list (names and/or MMSI/IMO numbers)?
export function matchesFavorites(e, vessel, favorites) {
  const name = (e.name || "").toUpperCase();
  return (favorites || []).some((f) => {
    const s = String(f).trim().toUpperCase();
    if (!s) return false;
    if (/^\d+$/.test(s)) return s === String(e.mmsi) || s === String(vessel?.imo || "");
    return name === s;
  });
}

// Run a full update: merge messages into the previous state and find events.
export function processUpdate(prevState, messages, nowIso) {
  const prevVessels = prevState?.vessels || {};
  const vessels = {};
  for (const [k, v] of Object.entries(prevVessels)) vessels[k] = { ...v };
  for (const m of messages) applyMessage(vessels, m, nowIso);

  const events = [];
  const now = Date.parse(nowIso);
  for (const [k, v] of Object.entries(vessels)) {
    // Forget ships not heard from in 18 hours.
    if (!v.lastSeen || now - Date.parse(v.lastSeen) > 18 * 3600e3) { delete vessels[k]; continue; }
    const prev = prevVessels[k];
    describe(v);
    events.push(...detectEvents(prev, v, nowIso));
  }
  events.forEach((e) => (e.id = `${e.mmsi}-${e.type}-${e.time}`));
  const allEvents = [...events, ...(prevState?.events || [])].slice(0, 150);
  return { updated: nowIso, vessels, events: allEvents, newEvents: events };
}

// Is the ship riding deep (loaded) or high (empty)? Based on the draught the
// crew enters into AIS, so treat it as a hint.
export function loadState(v) {
  if (!v.draught || !v.length || v.length < 100) return null;
  if (v.draught >= 7) return { loaded: true, text: "Loaded, sitting deep in the water" };
  if (v.draught <= 5.5) return { loaded: false, text: "Riding high, probably empty and coming to load" };
  return null;
}

// Flag country from the first three digits of the MMSI (the "MID").
const MID = {
  "303": "United States", "338": "United States", "366": "United States", "367": "United States", "368": "United States", "369": "United States",
  "316": "Canada", "209": "Cyprus", "210": "Cyprus", "212": "Cyprus", "211": "Germany", "218": "Germany", "215": "Malta", "229": "Malta",
  "248": "Malta", "249": "Malta", "256": "Malta", "219": "Denmark", "220": "Denmark", "232": "United Kingdom", "233": "United Kingdom",
  "235": "United Kingdom", "237": "Greece", "239": "Greece", "240": "Greece", "241": "Greece", "244": "Netherlands", "245": "Netherlands",
  "246": "Netherlands", "255": "Portugal (Madeira)", "257": "Norway", "258": "Norway", "259": "Norway", "261": "Poland", "271": "Turkey",
  "305": "Antigua & Barbuda", "308": "Bahamas", "309": "Bahamas", "311": "Bahamas", "314": "Barbados", "351": "Panama", "352": "Panama",
  "353": "Panama", "354": "Panama", "355": "Panama", "356": "Panama", "357": "Panama", "370": "Panama", "371": "Panama", "372": "Panama",
  "373": "Panama", "477": "Hong Kong", "538": "Marshall Islands", "563": "Singapore", "564": "Singapore", "565": "Singapore", "566": "Singapore",
  "636": "Liberia", "224": "Spain", "225": "Spain", "226": "France", "227": "France", "228": "France", "230": "Finland", "265": "Sweden", "266": "Sweden",
  "247": "Italy", "236": "Gibraltar", "304": "Antigua & Barbuda", "431": "Japan", "440": "South Korea", "412": "China", "413": "China", "414": "China",
};
export function flagOf(mmsi) {
  const c = MID[String(mmsi).slice(0, 3)];
  if (!c) return null;
  return { country: c, lakes: c === "United States" || c === "Canada" };
}
