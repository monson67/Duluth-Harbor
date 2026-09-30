// Canal Park Virtual Visitor Center — main app.
import { play } from "./sounds.js";
import { sunTimes, moonPhase } from "./sky.js";
import { ENTRIES, eventText, matchesFavorites, isCommercial } from "../scripts/harbor.mjs";

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
const camList = () => store.get("cameras", CFG.cameras);
function camSrc(c) {
  if (c.channel) return `https://www.youtube.com/embed/live_stream?channel=${c.channel}&autoplay=1&mute=1&playsinline=1`;
  return `https://www.youtube-nocookie.com/embed/${c.youtube}?autoplay=1&mute=1&playsinline=1&rel=0`;
}
function allCams() {
  const mine = camList();
  const ids = new Set(mine.map((c) => c.youtube || c.channel));
  return [...mine, ...liveCams.filter((c) => !ids.has(c.youtube)).map((c) => ({ ...c, auto: true }))];
}
function renderCams() {
  const layout = store.get("camLayout", 2);
  const grid = $("#camGrid");
  grid.className = `cam-grid layout-${layout}`;
  $$(".seg button").forEach((b) => b.classList.toggle("on", +b.dataset.layout === layout));
  const cams = allCams();
  const picks = store.get("camPicks", [0, 1, 2, 3]);
  grid.innerHTML = "";
  for (let i = 0; i < layout; i++) {
    const idx = Math.min(picks[i] ?? i, cams.length - 1);
    const cam = cams[idx] || cams[0];
    if (!cam) break;
    const tile = document.createElement("div");
    tile.className = "cam";
    const opts = cams.map((c, j) => `<option value="${j}" ${j === idx ? "selected" : ""}>${esc(c.title)}${c.auto ? " (live now)" : ""}</option>`).join("");
    tile.innerHTML = `<select aria-label="Choose camera">${opts}</select>
      <iframe src="${camSrc(cam)}" title="${esc(cam.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`;
    tile.querySelector("select").onchange = (e) => { picks[i] = +e.target.value; store.set("camPicks", picks); renderCams(); };
    grid.append(tile);
  }
}
function parseYouTube(url) {
  const m = String(url).match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})/) || String(url).match(/^([\w-]{11})$/);
  return m && m[1];
}
function renderCamDialog() {
  $("#camChannelLink").href = CFG.cameraChannelPage;
  const cams = camList();
  $("#camList").innerHTML = cams.map((c, i) => `<li><span>${esc(c.title)}</span><button class="btn small" data-i="${i}">Remove</button></li>`).join("");
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
  getJson("data/cams.json").then((d) => { liveCams = d.cams || []; if (liveCams.length) renderCams(); }).catch(() => {});
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

// ---------- lake ----------
async function updateLake() {
  const stats = [];
  const add = (k, v, s = "") => v != null && stats.push({ k, v, s });
  try {
    const d = await getJson("data/lake.json");
    const buoy = d.stations["45028"] || d.stations["45027"];
    const canal = d.stations.DULM5;
    if (buoy?.waterC != null) add("Lake water", `${Math.round(cToF(buoy.waterC))}°F`, buoy.name);
    if (buoy?.waveM != null) add("Waves", `${(buoy.waveM * 3.281).toFixed(1)} ft`, buoy.wavePeriodS ? `every ${buoy.wavePeriodS} s` : buoy.name);
    const w = canal?.windMs != null ? canal : buoy;
    if (w?.windMs != null) add("Wind at canal", `${Math.round(w.windMs * 1.94384)} kn`, `${compass(w.windDirDeg)}${w.gustMs ? `, gusts ${Math.round(w.gustMs * 1.94384)}` : ""}`);
    if (canal?.airC != null) add("Air at canal", `${Math.round(cToF(canal.airC))}°F`, "Duluth pier station");
  } catch {}
  try {
    const d = await getJson(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${CFG.noaaWaterStation}&product=water_level&datum=IGLD&units=english&time_zone=gmt&format=json&application=canal_park_visitor_center`);
    const v = d.data?.[0];
    if (v) add("Harbor level", `${(+v.v).toFixed(2)} ft`, "above IGLD 1985 datum");
  } catch {}
  $("#lakeStats").innerHTML = stats.length
    ? stats.map((s) => `<div class="stat"><div class="k">${esc(s.k)}</div><div class="v">${esc(s.v)}</div><div class="s">${esc(s.s)}</div></div>`).join("")
    : `<div class="empty">Lake data isn't available yet.</div>`;
}

// ---------- sun & moon ----------
function updateSky() {
  const { lat, lon } = CFG.location;
  const now = new Date();
  const s = sunTimes(now, lat, lon);
  const m = moonPhase(now);
  const len = s.sunrise && s.sunset ? (s.sunset - s.sunrise) / 3600000 : 0;
  const items = [
    ["Sunrise", s.sunrise ? fmtTime(s.sunrise) : "—", s.dawn ? `first light ${fmtTime(s.dawn)}` : ""],
    ["Sunset", s.sunset ? fmtTime(s.sunset) : "—", s.dusk ? `last light ${fmtTime(s.dusk)}` : ""],
    ["Golden hour", s.goldenStart ? fmtTime(s.goldenStart) : "—", "best bridge photos"],
    ["Daylight", `${Math.floor(len)}h ${Math.round((len % 1) * 60)}m`, ""],
    ["Moon", `${m.icon} ${Math.round(m.illum * 100)}%`, m.name],
  ];
  $("#skyStats").innerHTML = items.map(([k, v, sub]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join("");
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
  renderShips(); renderFavs();
}
const shipLink = (v) => `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${v.mmsi}`;
const tagFor = (v) => {
  if (v.approachEntry) return `<span class="tag in">Inbound</span>`;
  if (/anchor/i.test(v.status)) return `<span class="tag anchor">Anchored</span>`;
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
    <div class="name"><a href="${shipLink(v)}" target="_blank" rel="noopener">${esc(v.name || "MMSI " + v.mmsi)}</a></div>
    <div class="when">${when}</div>
    <div class="meta">${tagFor(v)}${esc(v.status || "")} · ${esc(bits.join(" · "))}</div>
  </li>`;
}
function eventRow(e) {
  const t = eventText(e);
  const inbound = e.type === "approaching" || e.type === "arrived";
  return `<li class="ship"><span>${inbound ? "⬇️" : "⬆️"}</span>
    <div class="name">${esc(e.name)}</div><div class="when">${fmtTime(e.time)}<small>${esc(fmtDay(e.time))}</small></div>
    <div class="meta"><span class="tag ${inbound ? "in" : "out"}">${esc(e.type)}</span>${esc(t.body)}</div></li>`;
}
function renderShips() {
  const body = $("#shipsBody");
  $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === shipTab));
  if (shipTab === "schedule") {
    body.innerHTML = `<p class="fine" style="margin-top:0">Posted schedules from the port community (open in a new tab):</p><ul class="links">${CFG.scheduleLinks.map((l) => `<li><a href="${l.url}" target="_blank" rel="noopener">${esc(l.name)}</a></li>`).join("")}</ul>`;
    return;
  }
  if (!shipData || !shipData.updated) {
    body.innerHTML = `<div class="empty">Live ship tracking isn't turned on yet.<br>See step 3 in the README to connect your free aisstream.io key.<br>Meanwhile, check the <button class="linkish" data-goto="schedule">official schedules</button>.</div>`;
    $("[data-goto]", body)?.addEventListener("click", () => { shipTab = "schedule"; renderShips(); });
    return;
  }
  const showSmall = $("#showSmall").checked;
  const vessels = Object.values(shipData.vessels || {}).filter((v) => v.lat != null && (showSmall || isCommercial(v) || isFav(v)));
  let html = "";
  if (shipTab === "coming") {
    const coming = vessels.filter((v) => v.approachEntry).sort((a, b) => a.etaMinutes - b.etaMinutes);
    const moving = vessels.filter((v) => v.status === "Underway in harbor");
    const anchored = vessels.filter((v) => /anchor/i.test(v.status));
    const recent = (shipData.events || []).filter((e) => Date.now() - new Date(e.time) < 6 * 3600e3 && (e.type === "arrived" || e.type === "departed")).slice(0, 6);
    const sec = (title, list, fn) => list.length ? `<h3>${title}</h3><ul class="ship-list">${list.map(fn).join("")}</ul>` : "";
    html = sec("Heading for the harbor", coming, shipRow) + sec("On the move in the harbor", moving, shipRow) +
      sec("Waiting at anchor", anchored, shipRow) + sec("Recently passed through", recent, eventRow);
    if (!html) html = `<div class="empty">No big ships on the move right now. Check "All nearby" to see who's at the docks.</div>`;
  } else if (shipTab === "all") {
    const list = vessels.sort((a, b) => (a.canalDistanceNm ?? 99) - (b.canalDistanceNm ?? 99));
    html = list.length ? `<ul class="ship-list">${list.map(shipRow).join("")}</ul>` : `<div class="empty">No ships reported nearby.</div>`;
  } else if (shipTab === "log") {
    const log = (shipData.events || []).filter((e) => e.type === "arrived" || e.type === "departed");
    html = log.length ? `<p class="fine" style="margin-top:0">Ships through the Duluth canal pass under the Aerial Lift Bridge, so each one means a bridge lift.</p><ul class="ship-list">${log.slice(0, 40).map(eventRow).join("")}</ul>` : `<div class="empty">No passages logged yet.</div>`;
  }
  body.innerHTML = html;
  $$(".star", body).forEach((b) => (b.onclick = () => toggleFav(shipData.vessels[b.dataset.mmsi])));
}
async function updateShips() {
  try {
    shipData = await getJson(CFG.shipsDataUrl);
    $("#shipsAge").textContent = shipData.updated ? `updated ${ago(shipData.updated)}` : "not set up";
    checkEvents(shipData.events || []);
  } catch { $("#shipsAge").textContent = "offline"; }
  renderShips();
  renderMap();
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
let map, shipLayer;
const COLORS = { approach: "#ff8a00", harbor: "#1e88e5", dock: "#8a99a8", anchor: "#e0b000", lake: "#16a3a3" };
function initMap() {
  if (!window.L) { $("#map").innerHTML = `<div class="empty">Map couldn't load.</div>`; return; }
  const { lat, lon } = CFG.location;
  map = L.map("map", { scrollWheelZoom: false }).setView([lat - 0.02, lon + 0.02], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
  L.circleMarker([lat, lon], { radius: 6, color: "#d92d2d", fillOpacity: 1 }).addTo(map).bindTooltip("Aerial Lift Bridge");
  L.circleMarker([ENTRIES.superior.lat, ENTRIES.superior.lon], { radius: 5, color: "#555", fillOpacity: 1 }).addTo(map).bindTooltip("Superior Entry");
  shipLayer = L.layerGroup().addTo(map);
}
function renderMap() {
  if (!map || !shipData?.vessels) return;
  shipLayer.clearLayers();
  const showSmall = $("#showSmall").checked;
  for (const v of Object.values(shipData.vessels)) {
    if (v.lat == null || !(showSmall || isCommercial(v) || isFav(v))) continue;
    const kind = v.approachEntry ? "approach" : /anchor/i.test(v.status) ? "anchor" : v.status === "Underway in harbor" ? "harbor" : v.zone === "lake" ? "lake" : "dock";
    const moving = (v.sog || 0) >= 1;
    const rot = v.heading ?? v.cog ?? 0;
    const shape = moving ? `<path d="M11 1 L18 20 L11 16 L4 20 Z"/>` : `<circle cx="11" cy="11" r="6"/>`;
    const icon = L.divIcon({
      className: "ship-marker", iconSize: [22, 22], iconAnchor: [11, 11],
      html: `<svg viewBox="0 0 22 22" style="transform:rotate(${moving ? rot : 0}deg)" fill="${COLORS[kind]}" stroke="#fff" stroke-width="1.5">${shape}</svg>`,
    });
    L.marker([v.lat, v.lon], { icon, title: v.name }).addTo(shipLayer)
      .bindPopup(`<b>${esc(v.name || v.mmsi)}</b>${isFav(v) ? " ★" : ""}<br>${esc(v.status || "")}<br>${esc([v.typeName, ft(v.length), v.sog != null && `${v.sog.toFixed(1)} kn`].filter(Boolean).join(" · "))}${v.destination ? `<br>Destination: ${esc(v.destination)}` : ""}${v.etaMinutes != null ? `<br>At the entry in ~${v.etaMinutes} min` : ""}<br><a href="${shipLink(v)}" target="_blank" rel="noopener">Ship details</a>`);
  }
}

// ---------- facts ----------
const FACTS = [
  "The Aerial Lift Bridge opened in 1905 as a transporter bridge: a gondola carried people across the canal. It was rebuilt as a lift bridge in 1929–30.",
  "The bridge's roadway span can rise about 135 feet to let ships pass underneath.",
  "Ships and the bridge trade horn signals: a captain's long–short–short salute is answered by the bridge.",
  "The Duluth–Superior harbor is the farthest-inland freshwater seaport in North America, roughly 2,300 miles from the Atlantic by the St. Lawrence Seaway.",
  "The biggest Great Lakes freighters are 1,000 feet long, more than three football fields. They're too big to leave the Great Lakes.",
  "Ocean-going ships that visit the Great Lakes are nicknamed \"salties\". Ships that stay on the lakes are \"lakers\".",
  "The Duluth Ship Canal was dug through Minnesota Point in 1871, giving Duluth its own entry to the harbor.",
  "Lake Superior holds about 10% of the world's fresh surface water, enough to cover North and South America a foot deep.",
  "The canal current sloshes back and forth because of a seiche: the whole lake rocks like water in a bathtub.",
  "Iron ore pellets from Minnesota's Iron Range are the port's biggest cargo, along with coal, grain and limestone.",
  "Canal Park's lighthouses guard the entry: the South Breakwater Outer Light (1901) and the North Pier Light (1910).",
  "The shipping season runs from late March to mid-January, when the Soo Locks close for winter maintenance.",
];
function showFact(step = 1) {
  const i = (store.get("fact", -1) + step + FACTS.length) % FACTS.length;
  store.set("fact", i);
  $("#fact").textContent = FACTS[i];
}

// ---------- start ----------
function init() {
  tickClock(); setInterval(tickClock, 15000);
  initCams(); initRadio(); initSettings(); initMap();
  updateCurrent(); setInterval(updateCurrent, 5 * 60e3);
  updateWeather(); setInterval(updateWeather, 10 * 60e3);
  updateLake(); setInterval(updateLake, 15 * 60e3);
  updateSky(); setInterval(updateSky, 30 * 60e3);
  updateShips(); setInterval(updateShips, 2 * 60e3);
  $$(".tabs button").forEach((b) => (b.onclick = () => { shipTab = b.dataset.tab; renderShips(); }));
  $("#showSmall").onchange = () => { renderShips(); renderMap(); };
  $$(".horn").forEach((b) => (b.onclick = () => {
    const r = play(b.dataset.horn);
    if (b.dataset.horn === "waves") { b.classList.toggle("playing", r); return; }
    b.classList.add("playing"); setTimeout(() => b.classList.remove("playing"), r || 1000);
  }));
  showFact(); $("#nextFact").onclick = () => showFact();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { updateShips(); updateCurrent(); } });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
