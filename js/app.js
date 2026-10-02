// Canal Park Virtual Visitor Center — main app.
import { play } from "./sounds.js";
import { sunTimes, moonPhase, moonTimes } from "./sky.js";
import { GUIDE, FACTS } from "./guide.js";
import { shipPhoto, photoOfTheDay } from "./photos.js";
import { ENTRIES, eventText, matchesFavorites, isFreighter, describe, loadState, flagOf, bearing, distanceNm } from "../scripts/harbor.mjs";

const CFG = window.CANAL_CONFIG;
const TZ = "America/Chicago";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// ---------- small helpers ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("cp." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("cp." + k, JSON.stringify(v)); } catch {} },
};
async function getJson(url, ms = 15000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.json();
}
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const fmtDay = (d) => new Date(d).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
function ago(t) {
  const m = Math.round((Date.now() - new Date(t)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 36 ? `${h} hr ago` : fmtDay(t);
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cToF = (c) => (c == null ? null : c * 9 / 5 + 32);
const ft = (m) => (m ? `${Math.round(m * 3.281).toLocaleString()} ft` : "");
const compass = (d) => (d == null ? "" : ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(d / 22.5) % 16]);

function toast(title, body) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<b>${esc(title)}</b>${esc(body)}`;
  $("#toasts").append(t);
  setTimeout(() => t.remove(), 9000);
}

// ---------- clock ----------
function tickClock() {
  $("#clock").textContent = new Date().toLocaleString("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });
}

// ---------- cameras ----------
let liveCams = [];
let camChecks = {}; // YouTube's answer for each video: playable or not
const playable = (c) => !c.youtube || camChecks[c.youtube]?.ok !== false;
const camList = () => store.get("cameras", CFG.cameras).filter((c) => !c.channel);
function camSrc(c) {
  if (c.channel) return `https://www.youtube.com/embed/live_stream?channel=${c.channel}&autoplay=1&mute=1&playsinline=1`;
  return `https://www.youtube-nocookie.com/embed/${c.youtube}?autoplay=1&mute=1&playsinline=1&rel=0`;
}
function allCams() {
  const mine = camList().filter(playable);
  const ids = new Set(mine.map((c) => c.youtube));
  return [...mine, ...liveCams.filter((c) => !ids.has(c.youtube)).map((c) => ({ ...c, auto: c.from === "channel" }))];
}
// Which mapped camera spot does a camera stream belong to?
function spotFor(cam) {
  if (cam.spot === "none") return null;
  const spots = CFG.cameraSpots || [];
  if (cam.spot) return spots.find((s) => s.key === cam.spot) || null;
  return spots.find((s) => new RegExp(s.match, "i").test(cam.title || "")) || null;
}
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
function inView(spot, v) {
  if (!spot || v.lat == null) return false;
  const d = distanceNm(spot.lat, spot.lon, v.lat, v.lon);
  return d <= spot.range && (d < 0.05 || angleDiff(bearing(spot.lat, spot.lon, v.lat, v.lon), spot.bearing) <= spot.fov / 2);
}
function shipsInView(spot) {
  if (!spot || !shipData?.vessels) return [];
  return Object.values(shipData.vessels).filter((v) => isFreighter(v) && inView(spot, v))
    .sort((a, b) => distanceNm(spot.lat, spot.lon, a.lat, a.lon) - distanceNm(spot.lat, spot.lon, b.lat, b.lon));
}
function updateCamBadges() {
  $$("#camGrid .cam").forEach((tile) => {
    const cam = allCams()[+tile.dataset.cam];
    const box = tile.querySelector(".inview");
    const list = cam ? shipsInView(spotFor(cam)).slice(0, 3) : [];
    box.innerHTML = list.map((v) => `<span data-mmsi="${v.mmsi}" title="Tap for ship details">${esc(v.name || v.mmsi)}</span>`).join("");
    $$("span", box).forEach((b) => (b.onclick = () => openShip(b.dataset.mmsi)));
  });
}
// Put a ship's best camera in the first tile.
function watchOnCamera(mmsi) {
  const v = shipData?.vessels?.[mmsi];
  if (!v) return;
  const cams = allCams();
  const idx = cams.findIndex((c) => inView(spotFor(c), v));
  if (idx < 0) { toast("No camera sees that ship right now", "Try again when it's closer to the canal."); return; }
  const picks = store.get("camPicks", [0, 1, 2, 3]);
  picks[0] = idx; store.set("camPicks", picks);
  renderCams();
  $("#shipDialog").open && $("#shipDialog").close();
  const tile = $("#camGrid .cam");
  tile.scrollIntoView({ behavior: "smooth", block: "center" });
  tile.classList.add("flash-focus"); setTimeout(() => tile.classList.remove("flash-focus"), 2500);
}
function renderCams() {
  const layout = store.get("camLayout", 2);
  const grid = $("#camGrid");
  grid.className = `cam-grid layout-${layout}`;
  $$(".seg button").forEach((b) => b.classList.toggle("on", +b.dataset.layout === layout));
  const cams = allCams();
  const picks = store.get("camPicks", [0, 1, 2, 3]);
  grid.innerHTML = "";
  for (let i = 0; i < Math.min(layout, cams.length); i++) {
    const idx = Math.min(picks[i] ?? i, cams.length - 1);
    const cam = cams[idx] || cams[0];
    if (!cam) break;
    const tile = document.createElement("div");
    tile.className = "cam";
    tile.dataset.cam = cams.indexOf(cam);
    const opts = cams.map((c, j) => `<option value="${j}" ${j === idx ? "selected" : ""}>${esc(c.title)}${c.auto ? " (live now)" : ""}</option>`).join("");
    tile.innerHTML = `<select aria-label="Choose camera">${opts}</select>
      <iframe src="${camSrc(cam)}" title="${esc(cam.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe><div class="inview"></div>`;
    tile.querySelector("select").onchange = (e) => { picks[i] = +e.target.value; store.set("camPicks", picks); renderCams(); };
    grid.append(tile);
  }
  updateCamBadges();
}
function parseYouTube(url) {
  const m = String(url).match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})/) || String(url).match(/^([\w-]{11})$/);
  return m && m[1];
}
function renderCamDialog() {
  $("#camChannelLink").href = CFG.cameraChannelPage;
  const cams = camList();
  $("#camList").innerHTML = cams.map((c, i) => `<li><span>${esc(c.title)}${playable(c) ? "" : ` <span class="muted">(not playing right now, hidden)</span>`}</span><button class="btn small" data-i="${i}">Remove</button></li>`).join("")
    + liveCams.map((c) => `<li><span>${esc(c.title)} <span class="muted">(found automatically)</span></span></li>`).join("");
  $$("#camList button").forEach((b) => (b.onclick = () => { const c = camList(); c.splice(+b.dataset.i, 1); store.set("cameras", c); renderCamDialog(); renderCams(); }));
}
function initCams() {
  $$(".seg button").forEach((b) => (b.onclick = () => { store.set("camLayout", +b.dataset.layout); renderCams(); }));
  $("#manageCams").onclick = () => { renderCamDialog(); $("#camDialog").showModal(); };
  $("#camForm").onsubmit = (e) => {
    e.preventDefault();
    const id = parseYouTube($("#camUrl").value.trim());
    if (!id) { toast("That doesn't look like a YouTube link", "Paste the full link from the YouTube stream page."); return; }
    const c = camList();
    c.push({ title: $("#camName").value.trim() || "Camera " + (c.length + 1), youtube: id });
    store.set("cameras", c);
    $("#camUrl").value = $("#camName").value = "";
    renderCamDialog(); renderCams();
  };
  $("#camReset").onclick = () => { store.set("cameras", CFG.cameras); store.set("camPicks", [0, 1, 2, 3]); renderCamDialog(); renderCams(); };
  renderCams();
  getJson("data/cams.json").then((d) => { liveCams = d.cams || []; camChecks = d.checked || {}; renderCams(); }).catch(() => {});
}

// ---------- marine radio ----------
function initRadio() {
  const r = CFG.radio;
  $("#radioName").textContent = r.name;
  $("#radioPage").href = r.pageUrl;
  let audioEl = null;
  const btn = $("#radioPlay"), state = $("#radioState"), eq = $("#radioEq"), vol = $("#radioVol");
  vol.value = store.get("radioVol", 0.8);
  const set = (label, on, live) => {
    state.textContent = label; state.classList.toggle("live", !!live);
    btn.classList.toggle("on", on); eq.classList.toggle("on", !!live);
    btn.setAttribute("aria-label", on ? "Pause" : "Play");
  };
  btn.onclick = () => {
    if (audioEl && !audioEl.paused) { audioEl.pause(); audioEl.removeAttribute("src"); audioEl.load(); set("Off", false); return; }
    audioEl ||= new Audio();
    audioEl.src = r.streamUrl + "?t=" + Date.now();
    audioEl.volume = +vol.value;
    audioEl.onplaying = () => set("LIVE", true, true);
    audioEl.onwaiting = () => set("Buffering…", true);
    audioEl.onerror = () => { set("Unavailable", false); toast("Radio didn't start", "The feed may be down. Try the Broadcastify link below."); };
    set("Connecting…", true);
    audioEl.play().catch(() => set("Tap play again", false));
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: r.name, artist: "Canal Park Visitor Center" });
      navigator.mediaSession.setActionHandler("pause", () => btn.click());
      navigator.mediaSession.setActionHandler("play", () => btn.click());
    }
  };
  vol.oninput = () => { if (audioEl) audioEl.volume = +vol.value; store.set("radioVol", +vol.value); };
  $("#radioMute").onclick = () => { if (!audioEl) return; audioEl.muted = !audioEl.muted; $("#radioMute").style.opacity = audioEl.muted ? 0.5 : 1; };
}

// ---------- canal current ----------
const KNOTS_PER_FTS = 0.592484;
const VELOCITY_CODES = ["72255", "72254", "72149", "72321", "72322", "72323"];

function pickVelocity(readings) {
  for (const code of VELOCITY_CODES) {
    const r = readings.filter((x) => x.code === code && Number.isFinite(x.value));
    if (r.length) return r.sort((a, b) => new Date(a.time) - new Date(b.time));
  }
  const r = readings.filter((x) => /ft\/s/i.test(x.unit || "") && Number.isFinite(x.value));
  return r.sort((a, b) => new Date(a.time) - new Date(b.time));
}
async function loadCurrentLive() {
  const site = CFG.usgsSite;
  try {
    const d = await getJson(`https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?f=json&monitoring_location_id=USGS-${site}&time=PT12H&limit=2000`);
    const readings = (d.features || []).map((f) => f.properties).filter((p) => p.value != null)
      .map((p) => ({ code: p.parameter_code, time: p.time, value: +p.value, unit: p.unit_of_measure }));
    if (readings.length) return readings;
  } catch {}
  try {
    const d = await getJson(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&period=PT12H`);
    const out = [];
    for (const ts of d.value.timeSeries) for (const v of ts.values[0].value)
      out.push({ code: ts.variable.variableCode[0].value, time: v.dateTime, value: +v.value, unit: ts.variable.unit.unitCode });
    if (out.length) return out;
  } catch {}
  const d = await getJson("data/current.json");
  return d.readings || [];
}
export function currentState(kn) {
  // USGS convention: positive = downstream = flowing out to the lake.
  const abs = Math.abs(kn);
  if (abs < 0.75) return { color: "amber", flash: false, dir: "Neutral / weak current", flow: "still" };
  const out = kn > 0;
  return {
    color: out ? "green" : "red", flash: abs > 1.5, flow: out ? "out" : "in",
    dir: out ? "Outbound — flowing out to the lake" : "Inbound — flowing in from the lake",
  };
}
async function updateCurrent() {
  try {
    const series = pickVelocity(await loadCurrentLive());
    if (!series.length) throw new Error("no data");
    const last = series[series.length - 1];
    const kn = last.value * KNOTS_PER_FTS;
    const s = currentState(kn);
    const sig = $("#signal"), mini = $("#miniLight");
    for (const el of [sig, mini]) { el.classList.remove("red", "amber", "green", "flash"); el.classList.add(s.color); if (s.flash) el.classList.add("flash"); }
    $("#currentSpeed").textContent = `${Math.abs(kn).toFixed(2)} kn`;
    $("#currentDir").textContent = s.dir + (s.flash ? " — strong!" : "");
    $("#currentAge").textContent = ago(last.time);
    $("#currentNote").textContent = `${Math.abs(last.value).toFixed(2)} ft/s · USGS sensor reading at ${fmtTime(last.time)}. Lake Superior's seiche makes the canal current slosh in and out.`;
    const flow = $("#flowAnim");
    flow.classList.remove("in", "out", "still"); flow.classList.add(s.flow);
    flow.style.setProperty("--flow-speed", `${Math.max(0.8, 4 - Math.abs(kn) * 1.6)}s`);
    mini.title = `Canal current: ${Math.abs(kn).toFixed(2)} kn, ${s.dir}`;
    drawSpark(series.slice(-96).map((x) => x.value * KNOTS_PER_FTS));
  } catch {
    $("#currentDir").textContent = "Current data unavailable right now.";
    $("#currentAge").textContent = "offline";
  }
}
function drawSpark(vals) {
  const svg = $("#currentSpark");
  if (vals.length < 2) { svg.innerHTML = ""; return; }
  const max = Math.max(0.5, ...vals.map(Math.abs));
  const y = (v) => 25 - (v / max) * 22;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${(i / (vals.length - 1)) * 200},${y(v).toFixed(1)}`).join("");
  svg.innerHTML = `<line class="zero" x1="0" x2="200" y1="25" y2="25"/><path class="line" d="${d}"/>`;
  svg.setAttribute("aria-label", "Current over the last several hours: above the line is outbound, below is inbound");
}

// ---------- weather ----------
async function updateWeather() {
  const { lat, lon } = CFG.location;
  const nws = (p) => getJson(`https://api.weather.gov${p}`);
  try {
    let obs, station = CFG.weather.station;
    try { obs = (await nws(`/stations/${station}/observations/latest`)).properties; if (obs.temperature.value == null) throw 0; }
    catch { station = CFG.weather.fallbackStation; obs = (await nws(`/stations/${station}/observations/latest`)).properties; }
    const t = cToF(obs.temperature.value);
    $("#wxTemp").textContent = t == null ? "—" : `${Math.round(t)}°F`;
    $("#wxDesc").textContent = obs.textDescription || "";
    const mph = obs.windSpeed.value == null ? null : obs.windSpeed.value * 0.621371;
    const gust = obs.windGust?.value ? ` gusting ${Math.round(obs.windGust.value * 0.621371)}` : "";
    $("#wxWind").textContent = mph == null ? "" : mph < 1 ? "Calm" : `Wind ${compass(obs.windDirection.value)} ${Math.round(mph)} mph${gust}`;
    $("#wxStation").textContent = `${station} · ${fmtTime(obs.timestamp)}`;
  } catch { $("#wxDesc").textContent = "Weather unavailable right now."; }
  try {
    const pt = (await nws(`/points/${lat.toFixed(4)},${lon.toFixed(4)}`)).properties;
    const hourly = (await getJson(pt.forecastHourly)).properties.periods;
    const pick = hourly.filter((_, i) => i % 3 === 0).slice(0, 6);
    $("#wxHours").innerHTML = pick.map((p) => `<div title="${esc(p.shortForecast)}">${esc(new Date(p.startTime).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric" }))}<b>${p.temperature}°</b>${esc(p.shortForecast.split(" ").slice(0, 2).join(" "))}</div>`).join("");
  } catch {}
  try {
    const al = (await nws(`/alerts/active?point=${lat},${lon}`)).features;
    const banner = $("#weatherAlert");
    if (al.length) {
      banner.hidden = false;
      banner.innerHTML = al.slice(0, 2).map((a) => `⚠️ <b>${esc(a.properties.event)}</b> — ${esc(a.properties.headline || "")}`).join("<br>") +
        ` · <a href="https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}" target="_blank" rel="noopener">details</a>`;
    } else banner.hidden = true;
  } catch {}
  $("#radarImg").src = `${CFG.weather.radarLoop}?t=${Math.floor(Date.now() / 300000)}`;
}

// ---------- lake conditions ----------
const stat = (k, v, sub = "") => `<div class="stat"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="s">${esc(sub)}</div></div>`;
async function updateLake() {
  const stats = [];
  let newest = null;
  const fresh = (t) => t && Date.now() - new Date(t) < 36 * 3600e3;
  try {
    const d = await getJson("data/lake.json");
    const st = d.stations || {};
    const buoy = [st["45028"], st["45027"]].find((b) => fresh(b?.time));
    const canal = st.DULM5;
    if (buoy?.waterC != null) stats.push(stat("Lake water", `${Math.round(cToF(buoy.waterC))}°F`, buoy.name));
    if (buoy?.waveM != null) stats.push(stat("Waves", `${(buoy.waveM * 3.281).toFixed(1)} ft`, buoy.wavePeriodS ? `every ${buoy.wavePeriodS} seconds` : buoy.name));
    if (!buoy && (st["45028"] || st["45027"])) stats.push(stat("Lake buoys", "Off season", "back in spring"));
    const w = fresh(canal?.time) && canal?.windMs != null ? canal : buoy;
    if (w?.windMs != null) stats.push(stat("Wind at canal", `${Math.round(w.windMs * 1.94384)} kn`, `from ${compass(w.windDirDeg)}${w.gustMs ? `, gusts ${Math.round(w.gustMs * 1.94384)}` : ""}`));
    if (fresh(canal?.time) && canal?.airC != null) stats.push(stat("Air at canal", `${Math.round(cToF(canal.airC))}°F`, "Duluth pier station"));
    if (fresh(canal?.time) && canal?.waterC != null && !(buoy?.waterC != null)) stats.push(stat("Water at canal", `${Math.round(cToF(canal.waterC))}°F`, "Duluth pier station"));
    newest = buoy?.time || canal?.time;
  } catch {}
  const coops = (product, extra = "") => getJson(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${CFG.noaaWaterStation}&product=${product}${extra}&units=english&time_zone=gmt&format=json&application=canal_park_visitor_center`);
  if (!stats.some((x) => /water/i.test(x))) {
    try { const v = (await coops("water_temperature")).data?.[0]; if (v) stats.unshift(stat("Harbor water", `${Math.round(+v.v)}°F`, "NOAA Duluth gauge")); } catch {}
  }
  try {
    const v = (await coops("water_level", "&datum=IGLD")).data?.[0];
    if (v) stats.push(stat("Harbor level", `${(+v.v).toFixed(2)} ft`, "above the IGLD 1985 datum"));
  } catch {}
  $("#lakeStats").innerHTML = stats.join("") || `<div class="empty">Lake readings aren't available right now.</div>`;
  $("#lakeAge").textContent = newest ? `buoys ${ago(newest)}` : "";
}

function updateSky() {
  const { lat, lon } = CFG.location;
  const now = new Date();
  const s = sunTimes(now, lat, lon);
  const m = moonPhase(now);
  const mt = moonTimes(new Date(now - 3 * 3600e3), lat, lon);
  const len = s.sunrise && s.sunset ? (s.sunset - s.sunrise) / 3600000 : 0;
  const t = (d) => (d ? fmtTime(d) : "—");
  const items = [
    stat("Sunrise", t(s.sunrise), s.dawn ? `first light ${fmtTime(s.dawn)}` : ""),
    stat("Sunset", t(s.sunset), s.dusk ? `last light ${fmtTime(s.dusk)}` : ""),
    stat("Golden hour", t(s.goldenStart), "best bridge photos"),
    stat("Daylight", `${Math.floor(len)}h ${Math.round((len % 1) * 60)}m`, ""),
    stat("Moonrise", t(mt.rise), mt.set ? `moonset ${fmtTime(mt.set)}` : ""),
    stat("Moon", `${m.icon} ${Math.round(m.illum * 100)}%`, m.daysToFull < 1.5 ? "Full moon tonight!" : m.name),
  ];
  $("#skyStats").innerHTML = items.join("");
}

// ---------- ships ----------
let shipData = null;
let shipTab = "coming";
const favs = () => store.get("favorites", []);
const isFav = (v) => matchesFavorites({ name: v.name, mmsi: v.mmsi }, v, favs());
function toggleFav(v) {
  const f = favs();
  const i = f.findIndex((x) => String(x).toUpperCase() === String(v.name || v.mmsi).toUpperCase() || String(x) === String(v.mmsi));
  if (i >= 0) f.splice(i, 1); else f.push(v.name || String(v.mmsi));
  store.set("favorites", f);
  renderShips(); renderFavs(); renderNext();
}
const shipLink = (v) => `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${v.mmsi}`;
let fleet = {};
const fleetInfo = (v) => fleet[(v?.name || "").toUpperCase()] || fleet[String(v?.mmsi)] || {};
function cargoText(v) {
  const f = fleetInfo(v), load = loadState(v);
  const parts = [];
  if (f.cargo) parts.push(`Usually carries: ${f.cargo}`);
  if (load) parts.push(load.text);
  if (!parts.length && v.typeName === "Tanker") parts.push("Liquid cargo (tanker)");
  return parts.join(". ");
}
const PASSAGE_MS = (v) => new Date(v.lastSeen || shipData?.updated || Date.now()).getTime() + (v.etaMinutes || 0) * 60000;
function countdown(ms) {
  const m = Math.round((ms - Date.now()) / 60000);
  if (m <= 1) return "any minute";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}
const SHIP_SVG = `<svg viewBox="0 0 120 50" fill="currentColor" aria-hidden="true"><path d="M4 30h112l-10 14H14z"/><rect x="90" y="14" width="18" height="16" rx="2"/><rect x="95" y="6" width="6" height="8"/><rect x="14" y="24" width="72" height="6"/></svg>`;
function photoHtml(v, big = false) {
  const f = fleetInfo(v);
  const id = `ph-${v.mmsi}-${big ? "b" : "s"}`;
  if (f.photo) return `<div class="ship-photo"><img src="${esc(f.photo)}" alt="${esc(v.name)}"><div class="credit">${esc(f.photoCredit || "")}</div></div>`;
  setTimeout(async () => {
    const p = v.name ? await shipPhoto(v.name) : null;
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML = p
      ? `<img src="${esc(p.url)}" alt="${esc(v.name)}" loading="lazy"><div class="credit"><a href="${esc(p.page)}" target="_blank" rel="noopener">Photo: ${esc(p.artist || "Wikimedia Commons")}${p.license ? ` · ${esc(p.license)}` : ""}</a></div>`
      : `${SHIP_SVG}<div class="credit">No photo found. <a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`"${v.name}" ship`)}" target="_blank" rel="noopener">Search images</a></div>`;
  });
  return `<div class="ship-photo" id="${id}">${SHIP_SVG}</div>`;
}
function factsList(v) {
  const flag = flagOf(v.mmsi);
  const rows = [
    ["Length", ft(v.length)], ["Width", ft(v.beam)], ["Type", v.typeName],
    ["Flag", flag ? `${flag.country}${flag.lakes ? "" : " (a \"saltie\")"}` : ""],
    ["Destination", v.destination], ["Speed", v.sog != null ? `${v.sog.toFixed(1)} knots` : ""],
    ["Cargo", cargoText(v)], ["AIS / MMSI", v.mmsi], ["IMO", v.imo],
  ].filter(([, x]) => x);
  return `<dl class="facts-list">${rows.map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join("")}</dl>`;
}

// ---------- next ship card ----------
function nextCandidates() {
  if (!shipData?.vessels) return [];
  return Object.values(shipData.vessels)
    .filter((v) => isFreighter(v) && (v.approachEntry || v.departEntry) && v.etaMinutes != null)
    .sort((a, b) => PASSAGE_MS(a) - PASSAGE_MS(b));
}
function renderNext() {
  const body = $("#nextBody");
  if (!shipData?.updated) {
    body.innerHTML = `<div class="empty">Live ship tracking isn't turned on yet (see the README, step 3). Meanwhile, check the <a href="${CFG.scheduleSource.url}" target="_blank" rel="noopener">posted schedule</a>.</div>`;
    return;
  }
  $("#nextAge").textContent = `updated ${ago(shipData.updated)}`;
  const all = nextCandidates();
  const duluth = all.filter((v) => (v.approachEntry || v.departEntry) === "duluth");
  const v = duluth[0] || all[0];
  if (!v) {
    body.innerHTML = `<div class="empty">No big ships are heading for the canal right now. Ships at the docks and at anchor are listed under <i>Ship traffic</i>, and the <button class="linkish" data-goto-sched>posted schedule</button> shows who's expected later.</div>`;
    $("[data-goto-sched]", body).onclick = () => { shipTab = "schedule"; renderShips(); $(".ships").scrollIntoView({ behavior: "smooth" }); };
    return;
  }
  const entry = v.approachEntry || v.departEntry;
  const inbound = !!v.approachEntry;
  const when = PASSAGE_MS(v);
  const f = fleetInfo(v);
  const others = all.filter((x) => x !== v).slice(0, 4);
  body.innerHTML = `<div class="next-card">
      ${photoHtml(v, true)}
      <div class="next-info">
        <span class="tag ${inbound ? "in" : "out"}">${inbound ? "Arriving" : "Departing"} · ${esc(ENTRIES[entry].name)}</span>
        <h3><button data-open="${v.mmsi}">${esc(v.name || "MMSI " + v.mmsi)}</button>${isFav(v) ? " ★" : ""}</h3>
        <div class="countdown"><span class="big" id="nextCountdown">${countdown(when)}</span>
          <span class="muted">estimated ${entry === "duluth" ? "under the bridge" : "at the Superior Entry"} around <b>${fmtTime(when)}</b></span></div>
        ${factsList(v)}
        ${f.note ? `<p class="note">${esc(f.note)}</p>` : ""}
        <div class="row-actions">
          ${allCams().some((c) => inView(spotFor(c), v)) ? `<button class="btn small" data-watch="${v.mmsi}">📷 Watch on camera</button>` : ""}
          <button class="btn small" data-open="${v.mmsi}">Ship details</button>
          <button class="btn small" data-fav="${v.mmsi}">${isFav(v) ? "★ Favorite" : "☆ Favorite"}</button>
        </div>
      </div>
    </div>
    ${entry !== "duluth" ? `<p class="fine">No ships are headed for the Duluth canal right now. This one is using the Superior Entry, so it won't pass under the Aerial Lift Bridge.</p>` : ""}
    ${others.length ? `<div><div class="fine" style="margin:0 0 4px">Also coming up:</div><ul class="later">${others.map((o) => `<li><button data-open="${o.mmsi}">${esc(o.name || o.mmsi)} · ${o.approachEntry ? "in" : "out"} ${fmtTime(PASSAGE_MS(o))}${(o.approachEntry || o.departEntry) === "superior" ? " (Superior)" : ""}</button></li>`).join("")}</ul></div>` : ""}
    <p class="fine" style="margin-top:0">Estimate from the ship's current speed and position. Ships often slow down, wait at anchor or change plans.</p>`;
  wireShipButtons(body);
}
function tickNext() {
  const el = $("#nextCountdown"), v = nextCandidates().find((x) => (x.approachEntry || x.departEntry) === "duluth") || nextCandidates()[0];
  if (el && v) el.textContent = countdown(PASSAGE_MS(v));
}
function wireShipButtons(root) {
  $$("[data-open]", root).forEach((b) => (b.onclick = () => openShip(b.dataset.open)));
  $$("[data-watch]", root).forEach((b) => (b.onclick = () => watchOnCamera(b.dataset.watch)));
  $$("[data-fav]", root).forEach((b) => (b.onclick = () => toggleFav(shipData.vessels[b.dataset.fav])));
}

// ---------- ship profile ----------
function openShip(mmsi) {
  const v = shipData?.vessels?.[mmsi];
  if (!v) return;
  const f = fleetInfo(v);
  const cams = allCams().filter((c) => inView(spotFor(c), v));
  $("#shipDlgTitle").textContent = v.name || `MMSI ${v.mmsi}`;
  $("#shipDlgBody").innerHTML = `<div class="ship-dlg">
      ${photoHtml(v, false)}
      <p><b>${esc(v.status || "")}</b>${v.etaMinutes != null ? `: about ${countdown(PASSAGE_MS(v))} to the ${esc(ENTRIES[v.approachEntry || v.departEntry]?.name || "entry")} (${fmtTime(PASSAGE_MS(v))})` : ""}.
        ${v.canalDistanceNm != null ? `${v.canalDistanceNm.toFixed(1)} nautical miles from the Lift Bridge.` : ""} Last heard ${ago(v.lastSeen)}.</p>
      ${factsList(v)}
      ${f.note ? `<p class="note">${esc(f.note)}</p>` : ""}
      ${v.lastCanalPassage ? `<p class="fine">Last passed under the bridge ${v.lastCanalPassage.direction} at ${fmtTime(v.lastCanalPassage.time)}, ${fmtDay(v.lastCanalPassage.time)}.</p>` : ""}
      <div class="row-actions">
        ${cams.length ? `<button class="btn small" data-watch="${v.mmsi}">📷 Watch on ${esc(cams[0].title)}</button>` : ""}
        <button class="btn small" data-fav="${v.mmsi}">${isFav(v) ? "★ Favorite" : "☆ Add to favorites"}</button>
        <button class="btn small" data-mapto="${v.mmsi}">🗺 Show on map</button>
      </div>
      <p class="fine">More: <a href="${shipLink(v)}" target="_blank" rel="noopener">MarineTraffic</a> ·
        <a href="https://www.vesselfinder.com/vessels/details/${v.imo || v.mmsi}" target="_blank" rel="noopener">VesselFinder</a> ·
        <a href="https://www.google.com/search?q=${encodeURIComponent(`"${v.name}" boatnerd`)}" target="_blank" rel="noopener">BoatNerd</a></p>
    </div>`;
  const body = $("#shipDlgBody");
  wireShipButtons(body);
  $$("[data-fav]", body).forEach((b) => (b.onclick = () => { toggleFav(v); openShip(mmsi); }));
  $$("[data-mapto]", body).forEach((b) => (b.onclick = () => { $("#shipDialog").close(); focusMap(v); }));
  if (!$("#shipDialog").open) $("#shipDialog").showModal();
}
const tagFor = (v) => {
  if (v.approachEntry) return `<span class="tag in">Inbound</span>`;
  if (/anchor/i.test(v.status)) return `<span class="tag anchor">Anchored</span>`;
  if (v.departEntry) return `<span class="tag out">Outbound</span>`;
  if (v.status === "Underway in harbor") return `<span class="tag out">Moving</span>`;
  return "";
};
function shipRow(v) {
  const when = v.etaMinutes != null
    ? `~${v.etaMinutes} min<small>${fmtTime(Date.now() + v.etaMinutes * 60000)}</small>`
    : `${v.canalDistanceNm != null ? v.canalDistanceNm.toFixed(1) + " nm" : ""}<small>from bridge</small>`;
  const bits = [v.typeName, ft(v.length), v.destination && `→ ${v.destination}`, v.sog >= 0.5 && `${v.sog.toFixed(1)} kn`, `seen ${ago(v.lastSeen)}`].filter(Boolean);
  return `<li class="ship">
    <button class="star ${isFav(v) ? "on" : ""}" data-mmsi="${v.mmsi}" aria-label="Favorite ${esc(v.name)}">${isFav(v) ? "★" : "☆"}</button>
    <div class="name"><button class="linkish" data-open="${v.mmsi}">${esc(v.name || "MMSI " + v.mmsi)}</button></div>
    <div class="when">${when}</div>
    <div class="meta">${tagFor(v)}${esc(v.status || "")} · ${esc(bits.join(" · "))}</div>
  </li>`;
}
function eventRow(e) {
  const t = eventText(e);
  const inbound = e.type === "approaching" || e.type === "arrived";
  return `<li class="ship"><span>${inbound ? "⬇️" : "⬆️"}</span>
    <div class="name">${shipData?.vessels?.[e.mmsi] ? `<button class="linkish" data-open="${e.mmsi}">${esc(e.name)}</button>` : esc(e.name)}</div><div class="when">${fmtTime(e.time)}<small>${esc(fmtDay(e.time))}</small></div>
    <div class="meta"><span class="tag ${inbound ? "in" : "out"}">${esc(e.type)}</span>${esc(t.body)}</div></li>`;
}
function renderShips() {
  const body = $("#shipsBody");
  $$(".ships .tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === shipTab));
  if (shipTab === "schedule") { renderSchedule(body); return; }
  if (!shipData || !shipData.updated) {
    body.innerHTML = `<div class="empty">Live ship tracking isn't turned on yet.<br>See step 3 in the README to connect your free aisstream.io key.<br>Meanwhile, check the <button class="linkish" data-goto="schedule">official schedules</button>.</div>`;
    $("[data-goto]", body)?.addEventListener("click", () => { shipTab = "schedule"; renderShips(); });
    return;
  }
  // Lists, the bridge log and alerts are for freighters only; other boats appear only on the map.
  const vessels = Object.values(shipData.vessels || {}).filter((v) => v.lat != null && isFreighter(v));
  const events = (shipData.events || []).filter((e) => isFreighter(shipData.vessels?.[e.mmsi] || e));
  let html = "";
  if (shipTab === "coming") {
    const coming = vessels.filter((v) => v.approachEntry).sort((a, b) => a.etaMinutes - b.etaMinutes);
    const leaving = vessels.filter((v) => v.departEntry).sort((a, b) => a.etaMinutes - b.etaMinutes);
    const moving = vessels.filter((v) => v.status === "Underway in harbor");
    const anchored = vessels.filter((v) => v.status === "At anchor off Duluth");
    const recent = events.filter((e) => Date.now() - new Date(e.time) < 6 * 3600e3 && (e.type === "arrived" || e.type === "departed")).slice(0, 6);
    const sec = (title, list, fn) => list.length ? `<h3>${title}</h3><ul class="ship-list">${list.map(fn).join("")}</ul>` : "";
    html = sec("Heading for the harbor", coming, shipRow) + sec("Heading out", leaving, shipRow) + sec("On the move in the harbor", moving, shipRow) +
      sec("Waiting at anchor", anchored, shipRow) + sec("Recently passed through", recent, eventRow);
    if (!html) html = `<div class="empty">No freighters on the move right now. Check "All on the lake" to see who's at the docks.</div>`;
  } else if (shipTab === "all") {
    const list = vessels.sort((a, b) => (a.canalDistanceNm ?? 99) - (b.canalDistanceNm ?? 99));
    html = list.length ? `<ul class="ship-list">${list.map(shipRow).join("")}</ul>` : `<div class="empty">No freighters reported nearby.</div>`;
  } else if (shipTab === "log") {
    const log = events.filter((e) => e.type === "arrived" || e.type === "departed");
    html = log.length ? `<p class="fine" style="margin-top:0">Ships through the Duluth canal pass under the Aerial Lift Bridge, so each one means a bridge lift.</p><ul class="ship-list">${log.slice(0, 40).map(eventRow).join("")}</ul>` : `<div class="empty">No passages logged yet.</div>`;
  }
  body.innerHTML = html;
  $$(".star", body).forEach((b) => (b.onclick = () => toggleFav(shipData.vessels[b.dataset.mmsi])));
  wireShipButtons(body);
}
// ---------- posted schedule (Harbor Lookout, as on Canal Park's site) ----------
function renderSchedule(body) {
  const src = CFG.scheduleSource;
  body.innerHTML = `<p class="fine" style="margin-top:0">Arrivals and departures from <b>${esc(src.name)}</b>, the same schedule
      <a href="https://canalpark.com/duluth-ship-schedule/" target="_blank" rel="noopener">Canal Park's ship schedule</a> shows.</p>
    <div class="sched-frame"><iframe src="${src.url}" title="${esc(src.name)} ship schedule" loading="lazy"></iframe></div>
    <div class="row-actions"><a class="btn small" href="${src.url}" target="_blank" rel="noopener">Open ${esc(src.name)} full screen ↗</a>
      ${CFG.scheduleLinks.filter((l) => l.url !== src.url).map((l) => `<a class="btn small" href="${l.url}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join("")}</div>
    <p class="fine">If the schedule area stays blank, use the full-screen button.</p>`;
}

// Ship data comes from two places: the 10-minute updater (ships.json, which
// also has alerts and the bridge log) and, when it's running, the live helper
// (positions every few seconds). Live positions are layered on top; if the
// helper is down, the site simply shows the 10-minute data.
let live = null, liveAt = 0;
const liveOn = () => live?.connected && live.vessels?.length && Date.now() - liveAt < 90e3;
function applyLive() {
  if (!shipData || !live?.vessels) return;
  shipData.vessels ||= {};
  for (const lv of live.vessels) {
    const v = (shipData.vessels[lv.mmsi] ||= { mmsi: lv.mmsi });
    if (!v.lastSeen || lv.lastSeen >= v.lastSeen) Object.assign(v, lv);
    describe(v);
  }
}
function showShipAge() {
  const pill = $("#shipsAge");
  pill.classList.toggle("ships-live", !!liveOn());
  pill.textContent = liveOn() ? "● Live" : !shipData ? "offline" : shipData.updated ? `updated ${ago(shipData.updated)}` : "not set up";
  pill.title = liveOn() ? "Ship positions update every 20 seconds" : "Ship positions update about every 10 minutes";
}
function renderAllShips() {
  showShipAge();
  renderShips();
  renderNext();
  renderMap();
  updateCamBadges();
}
async function updateLive() {
  if (!CFG.liveUrl || document.hidden) return;
  try {
    live = await getJson(CFG.liveUrl, 8000);
    liveAt = Date.now();
    applyLive();
  } catch { live = null; }
  renderAllShips();
}
async function updateShips() {
  try {
    shipData = await getJson(CFG.shipsDataUrl);
    checkEvents(shipData.events || []);
    applyLive();
  } catch { shipData = null; }
  renderAllShips();
}

// ---------- alerts ----------
const PREF_DEFAULTS = { approaching: true, arrived: true, departing: true, departed: false, duluthOnly: false, favoritesOnly: false, sound: true };
const prefs = () => ({ ...PREF_DEFAULTS, ...store.get("prefs", {}) });
function checkEvents(events) {
  if (!events.length) return;
  const newest = events[0].time;
  const last = store.get("lastEvent", null);
  store.set("lastEvent", newest);
  if (!last) return; // first visit: don't flood with old events
  const p = prefs();
  const fresh = events.filter((e) => e.time > last && Date.now() - new Date(e.time) < 3600e3)
    .filter((e) => isFreighter(shipData.vessels?.[e.mmsi] || e))
    .filter((e) => p[e.type])
    .filter((e) => !p.duluthOnly || e.entry === "duluth")
    .filter((e) => !p.favoritesOnly || matchesFavorites(e, shipData.vessels?.[e.mmsi], favs()));
  for (const e of fresh.reverse()) notify(eventText(e));
  if (fresh.length && p.sound) play("alert");
}
async function notify({ title, body }) {
  toast(title, body);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: title });
    else new Notification(title, { body });
  } catch {}
}
function renderFavs() {
  $("#favList").innerHTML = favs().map((f, i) => `<li>${esc(f)}<button data-i="${i}" aria-label="Remove">×</button></li>`).join("") || `<li class="fine">None yet</li>`;
  $$("#favList button").forEach((b) => (b.onclick = () => { const f = favs(); f.splice(+b.dataset.i, 1); store.set("favorites", f); renderFavs(); renderShips(); }));
}
function renderNtfy() {
  const t = $("#ntfyTopic").value.trim();
  store.set("ntfyTopic", t);
  $("#ntfyList").innerHTML = t ? [["all", "every ship event"], ["arrivals", "approaching & arrived"], ["departures", "heading out & departed"], ["favorites", "only ships in config/alerts.json"]]
    .map(([s, d]) => `<li><a href="https://ntfy.sh/${encodeURIComponent(t)}-${s}" target="_blank" rel="noopener">${esc(t)}-${s}</a> — ${d}</li>`).join("") : "";
}
function initSettings() {
  const dlg = $("#settings");
  $("#openSettings").onclick = () => { renderFavs(); dlg.showModal(); };
  const p = prefs();
  $$("[data-pref]").forEach((c) => { c.checked = !!p[c.dataset.pref]; c.onchange = () => { store.set("prefs", { ...prefs(), [c.dataset.pref]: c.checked }); }; });
  const btn = $("#enableNotify");
  const refresh = () => {
    if (!("Notification" in window)) { btn.textContent = "Install to Home Screen to allow notifications"; btn.disabled = true; return; }
    if (Notification.permission === "granted") { btn.textContent = "Notifications are on ✓"; btn.disabled = true; }
    if (Notification.permission === "denied") { btn.textContent = "Notifications blocked in browser settings"; btn.disabled = true; }
  };
  btn.onclick = async () => { await Notification.requestPermission(); refresh(); if (Notification.permission === "granted") notify({ title: "Alerts are on", body: "You'll hear about ships while the app is open." }); };
  refresh();
  $("#favForm").onsubmit = (e) => {
    e.preventDefault();
    const v = $("#favInput").value.trim().toUpperCase();
    if (!v) return;
    const f = favs(); if (!f.includes(v)) f.push(v);
    store.set("favorites", f); $("#favInput").value = ""; renderFavs(); renderShips();
  };
  $("#ntfyTopic").value = store.get("ntfyTopic", "");
  $("#ntfyTopic").oninput = renderNtfy;
  renderNtfy();
  $("#miniLight").onclick = () => $(".current").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- map ----------
let map, shipLayer, coneLayer;
const markers = {};
const COLORS = { approach: "#ff8a00", depart: "#9c27b0", harbor: "#1e88e5", dock: "#8a99a8", anchor: "#e0b000", lake: "#16a3a3" };
function offset(lat, lon, brg, nm) {
  const r = nm / 3440.065, b = (brg * Math.PI) / 180, p1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(r) + Math.cos(p1) * Math.sin(r) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(p1), Math.cos(r) - Math.sin(p1) * Math.sin(p2));
  return [(p2 * 180) / Math.PI, (l2 * 180) / Math.PI];
}
function drawCones() {
  if (!coneLayer) return;
  coneLayer.clearLayers();
  if (!$("#showCones").checked) return;
  const cams = allCams();
  for (const spot of CFG.cameraSpots || []) {
    const pts = [[spot.lat, spot.lon]];
    for (let a = -spot.fov / 2; a <= spot.fov / 2; a += spot.fov / 12) pts.push(offset(spot.lat, spot.lon, spot.bearing + a, spot.range));
    const camIdx = cams.findIndex((c) => spotFor(c) === spot);
    const poly = L.polygon(pts, { color: "#4fb3e8", weight: 1, fillOpacity: 0.12, interactive: true }).addTo(coneLayer);
    const n = shipsInView(spot).length;
    poly.bindTooltip(`${spot.name}${n ? ` · ${n} ship${n > 1 ? "s" : ""} in view` : ""}${camIdx < 0 ? " (not in your camera list)" : ""}`, { sticky: true });
    if (camIdx >= 0) poly.on("click", () => { const picks = store.get("camPicks", [0, 1, 2, 3]); picks[0] = camIdx; store.set("camPicks", picks); renderCams(); $(".cams").scrollIntoView({ behavior: "smooth" }); });
  }
}
function initMap() {
  if (!window.L) { $("#map").innerHTML = `<div class="empty">Map couldn't load.</div>`; return; }
  const { lat, lon } = CFG.location;
  map = L.map("map", { scrollWheelZoom: false });
  // Three preset views. "Duluth" keeps Duluth and Superior in the lower left
  // so more of the lake shows; "Harbor" fits the Duluth-Superior harbor.
  const TWIN_PORTS_MID = [46.745, -92.10];
  const VIEWS = {
    harbor: () => map.fitBounds([[46.69, -92.21], [46.80, -91.99]]),
    duluth: () => {
      const z = 11, size = map.getSize();
      const p = map.project(TWIN_PORTS_MID, z).add([size.x * 0.25, -size.y * 0.25]);
      map.setView(map.unproject(p, z), z);
    },
    lake: () => map.fitBounds([[46.4, -92.2], [49.0, -84.4]]),
  };
  const ViewButtons = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create("div", "map-views");
      let presetMove = false;
      const buttons = [["harbor", "Harbor"], ["duluth", "Duluth"], ["lake", "Whole lake"]].map(([key, text]) => {
        const b = L.DomUtil.create("button", "map-view-btn", box);
        b.type = "button"; b.textContent = text; b.dataset.view = key;
        b.onclick = (e) => { L.DomEvent.stop(e); show(key); };
        return b;
      });
      const show = (key) => {
        presetMove = true; VIEWS[key]();
        buttons.forEach((b) => b.classList.toggle("on", b.dataset.view === key));
        map.once("moveend", () => (presetMove = false));
      };
      // Dragging or zooming by hand means no preset is current.
      map.on("dragstart zoomstart", () => { if (!presetMove) buttons.forEach((b) => b.classList.remove("on")); });
      L.DomEvent.disableClickPropagation(box);
      this.show = show;
      return box;
    },
  });
  const views = new ViewButtons({ position: "topright" }).addTo(map);
  views.show("duluth");
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
  coneLayer = L.layerGroup().addTo(map);
  shipLayer = L.layerGroup().addTo(map);
  $("#showCones").checked = store.get("showCones", false);
  $("#showCones").onchange = () => { store.set("showCones", $("#showCones").checked); drawCones(); };
  drawCones();
  map.on("popupopen", (e) => wireShipButtons(e.popup.getElement()));
  renderTypeLegend();
}
// Boat types: each gets its own top-down hull, drawn bow-up around (0,0).
// "deck" is a lighter cabin/pilothouse detail; "half" is half the hull length.
const TOUR_RE = new RegExp(`^(${(CFG.tourBoats || []).map((n) => n.replace(/[^\w ]/g, "")).join("|") || "$^"})\\b`, "i");
const SHIP_TYPES = {
  freighter: { label: "Freighter", z: 400, half: 15, w: 7, hull: "M0,-15 L3.5,-10 L3.5,15 L-3.5,15 L-3.5,-10 Z", deck: `<rect x="-2.5" y="9" width="5" height="4" rx=".8"/>` },
  tour: { label: "Vista Fleet tour boat", z: 300, half: 9.5, w: 7, hull: "M0,-9.5 C3.5,-7 3.5,-5 3.5,-3 L3.5,7.5 Q3.5,9.5 1.5,9.5 L-1.5,9.5 Q-3.5,9.5 -3.5,7.5 L-3.5,-3 C-3.5,-5 -3.5,-7 0,-9.5 Z", deck: `<rect x="-2" y="-4" width="4" height="11" rx="1"/>` },
  tug: { label: "Tug", z: 200, half: 6.5, w: 8, hull: "M0,-6.5 C4,-6.5 4,-3 4,0 L4,5 Q4,6.5 2.5,6.5 L-2.5,6.5 Q-4,6.5 -4,5 L-4,0 C-4,-3 -4,-6.5 0,-6.5 Z", deck: `<rect x="-2" y="-2" width="4" height="3.5" rx=".6"/>` },
  personal: { label: "Personal craft", z: 0, half: 5, w: 4, hull: "M0,-5 C2,-2 2,0 2,2 L2,5 L-2,5 L-2,2 C-2,0 -2,-2 0,-5 Z", deck: "" },
  other: { label: "Other (Coast Guard, research, cruise…)", z: 100, half: 7, w: 6, hull: "M0,-7 L3,-3 L3,7 L-3,7 L-3,-3 Z", deck: "" },
};
function shipType(v) {
  const t = v.type, len = v.length || 0;
  if (TOUR_RE.test(v.name || "")) return "tour";
  if (isFreighter(v)) return "freighter";
  if (t === 31 || t === 32 || t === 52 || t === 33) return "tug";
  if (t === 36 || t === 37) return "personal";
  if ((t >= 30 && t <= 59) || (t >= 60 && t <= 69) || /^(R\/V|USCG|CG)\b/i.test(v.name || "")) return "other";
  return len && len >= 40 ? "other" : "personal";
}
const knots = (v) => `${v.sog.toFixed(1)} kn (${Math.round(v.sog * 1.151)} mph)`;
// One boat as SVG: hull in its status color pointing where it's going, with a
// fading wake behind it that grows with speed (none when stopped).
const ICON = 110;
function shipSvg(type, color, rot, sog, id) {
  const s = SHIP_TYPES[type], c = ICON / 2;
  const wake = sog >= 1 ? Math.min(6 + sog * 2.2, 36) : 0;
  const w = s.w / 2;
  const wakeSvg = wake ? `<defs><linearGradient id="wk${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".6"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="M${-w * 0.8},${s.half - 1} L${w * 0.8},${s.half - 1} L${w * 2.2},${s.half + wake} L${-w * 2.2},${s.half + wake} Z" fill="url(#wk${id})"/>` : "";
  return `<svg viewBox="0 0 ${ICON} ${ICON}" width="${ICON}" height="${ICON}"><g transform="translate(${c} ${c}) rotate(${rot})">${wakeSvg}
    <path class="hull" d="${s.hull}" fill="${color}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
    <g fill="#fff" fill-opacity=".85" pointer-events="none">${s.deck}</g></g></svg>`;
}
function renderTypeLegend() {
  const box = $("#typeLegend");
  if (!box) return;
  box.innerHTML = Object.entries(SHIP_TYPES).map(([k, s]) =>
    `<span><svg viewBox="-17 -7 34 14" width="34" height="14" aria-hidden="true"><g transform="rotate(90)"><path d="${s.hull}" fill="#8a99a8" stroke="#fff" stroke-width="1.2"/><g fill="#fff" fill-opacity=".85">${s.deck}</g></g></svg>${esc(s.label)}</span>`).join("") +
    `<span><svg viewBox="-17 -7 34 14" width="34" height="14" aria-hidden="true"><defs><linearGradient id="wkLegend"><stop offset="0" stop-color="#8a99a8" stop-opacity="0"/><stop offset="1" stop-color="#8a99a8" stop-opacity=".7"/></linearGradient></defs><path d="M-17,-4 L2,-1.5 L2,1.5 L-17,4 Z" fill="url(#wkLegend)"/><g transform="rotate(90)"><path d="${SHIP_TYPES.tug.hull}" fill="#8a99a8" stroke="#fff" stroke-width="1.2" transform="translate(0 -9)"/></g></svg>Longer wake = faster</span>`;
}
function renderMap() {
  if (!map || !shipData?.vessels) return;
  const showSmall = $("#showSmall").checked;
  const keep = new Set();
  for (const v of Object.values(shipData.vessels)) {
    const type = shipType(v);
    if (v.lat == null || (type === "personal" && !showSmall)) continue;
    const kind = v.approachEntry ? "approach" : v.departEntry ? "depart" : /anchor/i.test(v.status) ? "anchor" : v.status === "Underway in harbor" ? "harbor" : /^(At dock|Stopped)/.test(v.status || "") ? "dock" : v.zone === "lake" ? "lake" : "dock";
    const sog = v.sog || 0, moving = sog >= 1;
    const cog = v.cog != null && v.cog < 360 ? v.cog : null, hdg = v.heading != null && v.heading < 360 ? v.heading : null;
    const rot = (moving ? cog ?? hdg : hdg) ?? 0;
    const svg = shipSvg(type, COLORS[kind], rot, sog, v.mmsi);
    const seen = allCams().filter((c) => inView(spotFor(c), v));
    const label = `${v.name || v.mmsi} · ${SHIP_TYPES[type].label.replace(/ \(.*/, "")}${moving ? ` · ${knots(v)}` : ""}`;
    const popup = `<b>${esc(v.name || v.mmsi)}</b>${isFav(v) ? " ★" : ""}<br>${esc(v.status || "")}<br>${esc([type === "tour" ? "Harbor tour boat" : v.typeName, ft(v.length), moving ? knots(v) : v.sog != null && "Stopped"].filter(Boolean).join(" · "))}${v.destination ? `<br>Destination: ${esc(v.destination)}` : ""}${v.etaMinutes != null ? `<br>At the entry around ${fmtTime(PASSAGE_MS(v))}` : ""}
        ${seen.length ? `<br>In view of ${esc(seen.map((c) => c.title).join(", "))}` : ""}
        <br>${seen.length ? `<button class="btn small" data-watch="${v.mmsi}">📷 Watch</button> ` : ""}<button class="btn small" data-open="${v.mmsi}">Details</button>`;
    // Update existing markers in place, so an open popup stays open as ships move.
    let m = markers[v.mmsi];
    if (!m) m = markers[v.mmsi] = L.marker([v.lat, v.lon]).addTo(shipLayer).bindPopup("");
    m.setLatLng([v.lat, v.lon]).setZIndexOffset(SHIP_TYPES[type].z);
    if (m._cpSvg !== svg) {
      m.setIcon(L.divIcon({ className: "ship-marker", iconSize: [ICON, ICON], iconAnchor: [ICON / 2, ICON / 2], html: svg }));
      m._cpSvg = svg;
    }
    m.getElement()?.setAttribute("title", label);
    m.getElement()?.setAttribute("aria-label", label);
    if (m._cpPopup !== popup) {
      m.setPopupContent(popup);
      m._cpPopup = popup;
      if (m.isPopupOpen()) wireShipButtons(m.getPopup().getElement());
    }
    keep.add(v.mmsi);
  }
  for (const k of Object.keys(markers)) if (!keep.has(k)) { shipLayer.removeLayer(markers[k]); delete markers[k]; }
  drawCones();
}
function focusMap(v) {
  if (!map) return;
  $(".mapbox").scrollIntoView({ behavior: "smooth", block: "center" });
  map.setView([v.lat, v.lon], 13);
  markers[v.mmsi]?.openPopup();
}

// ---------- guide & photo of the day ----------
function initGuide() {
  const show = (key) => {
    $$("#guideTabs button").forEach((b) => b.classList.toggle("on", b.dataset.guide === key));
    $("#guideBody").innerHTML = GUIDE[key];
    store.set("guideTab", key);
  };
  $$("#guideTabs button").forEach((b) => (b.onclick = () => show(b.dataset.guide)));
  $("#guideBody").addEventListener("click", (e) => { const b = e.target.closest("[data-horn]"); if (b) play(b.dataset.horn); });
  show(store.get("guideTab", "bridge"));
}
async function updatePhoto() {
  const box = $("#photoBox");
  try {
    const p = await photoOfTheDay();
    if (!p) throw 0;
    box.innerHTML = `<a href="${esc(p.page)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="${esc(p.caption || p.title)}" loading="lazy"></a>
      <figcaption>${esc((p.caption || p.title.replace(/^File:|\.\w+$/g, "")).slice(0, 180))}${p.date ? ` · ${esc(p.date)}` : ""}<br>
      Photo: ${esc(p.artist || "unknown")}${p.license ? ` · ${esc(p.license)}` : ""} · Wikimedia Commons</figcaption>`;
  } catch { box.innerHTML = `<div class="empty">Today's photo couldn't load.</div>`; }
}

// ---------- facts ----------
function showFact(step = 1) {
  const i = (store.get("fact", -1) + step + FACTS.length) % FACTS.length;
  store.set("fact", i);
  $("#fact").textContent = FACTS[i];
}

// ---------- start ----------
function init() {
  tickClock(); setInterval(tickClock, 15000);
  initCams(); initRadio(); initSettings(); initMap(); initGuide(); updatePhoto();
  getJson(CFG.fleetUrl).then((d) => { fleet = d.ships || {}; renderNext(); }).catch(() => {});
  setInterval(tickNext, 30e3);
  updateCurrent(); setInterval(updateCurrent, 5 * 60e3);
  updateWeather(); setInterval(updateWeather, 10 * 60e3);
  updateLake(); setInterval(updateLake, 15 * 60e3);
  updateSky(); setInterval(updateSky, 30 * 60e3);
  updateShips(); setInterval(updateShips, 2 * 60e3);
  updateLive(); setInterval(updateLive, 20e3);
  $$(".ships .tabs button").forEach((b) => (b.onclick = () => { shipTab = b.dataset.tab; renderShips(); }));
  $("#showSmall").checked = store.get("showSmall", false);
  $("#showSmall").onchange = () => { store.set("showSmall", $("#showSmall").checked); renderMap(); };
  $$(".horn").forEach((b) => (b.onclick = () => {
    const r = play(b.dataset.horn);
    if (b.dataset.horn === "waves") { b.classList.toggle("playing", r); return; }
    b.classList.add("playing"); setTimeout(() => b.classList.remove("playing"), r || 1000);
  }));
  showFact(); $("#nextFact").onclick = () => showFact();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { updateShips(); updateLive(); updateCurrent(); } });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
