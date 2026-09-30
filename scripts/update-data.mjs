// Background updater. GitHub Actions runs this every ~10 minutes.
// It listens to live ship positions (AIS) around Duluth for a couple of
// minutes, works out arrivals/departures, sends phone alerts through
// ntfy.sh, and writes JSON files the web app reads.
//
// Settings come from environment variables (GitHub "secrets"):
//   AISSTREAM_API_KEY  free key from https://aisstream.io
//   NTFY_TOPIC         your private alert topic name (optional)
//   PREV_DATA_URL      where the last published data lives (set by the workflow)
//   LISTEN_SECONDS     how long to listen for ships (default 150)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { WATCH_BOX, processUpdate, eventText, matchesFavorites } from "./harbor.mjs";

const OUT = process.env.OUT_DIR || "data";
const LISTEN = Number(process.env.LISTEN_SECONDS || 150);
const now = () => new Date().toISOString();

async function getJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}
async function getText(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function loadPrevious(file) {
  if (process.env.PREV_DATA_URL) {
    try { return await getJson(`${process.env.PREV_DATA_URL.replace(/\/$/, "")}/${file}?t=${Date.now()}`); }
    catch (e) { console.log(`No previous ${file} online (${e.message})`); }
  }
  try { return JSON.parse(await readFile(`${OUT}/${file}`, "utf8")); } catch { return null; }
}

// --- Ships (aisstream.io) ----------------------------------------------------
function listenForShips(apiKey, seconds) {
  return new Promise((resolve) => {
    const messages = [];
    const ws = new WebSocket(process.env.AIS_URL || "wss://stream.aisstream.io/v0/stream");
    const done = () => { try { ws.close(); } catch {} resolve(messages); };
    const timer = setTimeout(done, seconds * 1000);
    ws.onopen = () => ws.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [WATCH_BOX],
      FilterMessageTypes: ["PositionReport", "ShipStaticData", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "StaticDataReport"],
    }));
    ws.onmessage = async (ev) => {
      try {
        const text = typeof ev.data === "string" ? ev.data : await new Response(ev.data).text();
        const m = JSON.parse(text);
        if (m.error) { console.log("aisstream error:", m.error); clearTimeout(timer); done(); return; }
        messages.push(m);
      } catch {}
    };
    ws.onerror = (e) => { console.log("aisstream connection problem:", e.message || e.type); };
    ws.onclose = () => { clearTimeout(timer); resolve(messages); };
  });
}

async function sendAlerts(newEvents, vessels) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic || !newEvents.length) return;
  let favorites = [];
  try { favorites = JSON.parse(await readFile("config/alerts.json", "utf8")).favorites || []; } catch {}
  for (const e of newEvents) {
    const { title, body } = eventText(e);
    const topics = [`${topic}-all`];
    if (e.type === "approaching" || e.type === "arrived") topics.push(`${topic}-arrivals`);
    if (e.type === "departing" || e.type === "departed") topics.push(`${topic}-departures`);
    if (matchesFavorites(e, vessels[e.mmsi], favorites)) topics.push(`${topic}-favorites`);
    for (const t of topics) {
      try {
        await fetch(`https://ntfy.sh/${encodeURIComponent(t)}`, {
          method: "POST", body,
          headers: { Title: title.replace(/[^\x20-\x7E]/g, "").trim(), Tags: "ship", Click: process.env.SITE_URL || "" },
          signal: AbortSignal.timeout(10000),
        });
      } catch (err) { console.log("ntfy failed:", err.message); }
    }
  }
  console.log(`Sent ${newEvents.length} alert(s).`);
}

async function updateShips() {
  const prev = await loadPrevious("ships.json");
  const key = process.env.AISSTREAM_API_KEY;
  if (!key) { console.log("AISSTREAM_API_KEY not set — skipping ships."); return prev; }
  console.log(`Listening for ships for ${LISTEN}s…`);
  const messages = await listenForShips(key, LISTEN);
  console.log(`Received ${messages.length} AIS messages.`);
  const state = processUpdate(prev, messages, now());
  const { newEvents, ...toSave } = state;
  const heard = new Set(messages.map((m) => String(m.MetaData?.MMSI)));
  const tracked = Object.values(state.vessels);
  console.log(`Heard ${heard.size} vessel(s) this run; tracking ${tracked.length} in the last 18 hours.`);
  for (const v of tracked.filter((v) => heard.has(String(v.mmsi))))
    console.log(`  ${v.name || v.mmsi} · ${v.typeName || "?"} · ${v.status || "?"}${v.etaMinutes != null ? ` · ~${v.etaMinutes} min to entry` : ""}`);
  for (const e of newEvents) console.log("EVENT", e.type, e.name, e.entry);
  await sendAlerts(newEvents, state.vessels);
  return toSave;
}

// --- Canal current (USGS) ----------------------------------------------------
async function updateCurrent() {
  const site = "464646092052900";
  const url = `https://api.waterdata.usgs.gov/ogcapi/v0/collections/continuous/items?f=json&monitoring_location_id=USGS-${site}&time=PT12H&limit=2000`;
  try {
    const d = await getJson(url);
    const readings = (d.features || []).map((f) => f.properties)
      .filter((p) => p.value != null)
      .map((p) => ({ code: p.parameter_code, time: p.time, value: Number(p.value), unit: p.unit_of_measure }));
    return { updated: now(), source: "USGS", readings };
  } catch (e) {
    console.log("USGS new API failed:", e.message);
  }
  const legacy = await getJson(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&period=PT12H`);
  const readings = [];
  for (const ts of legacy.value.timeSeries) {
    const code = ts.variable.variableCode[0].value;
    const unit = ts.variable.unit.unitCode;
    for (const v of ts.values[0].value) readings.push({ code, time: v.dateTime, value: Number(v.value), unit });
  }
  return { updated: now(), source: "USGS (legacy)", readings };
}

// --- Lake conditions (NOAA buoys) --------------------------------------------
function parseNdbc(text) {
  const lines = text.trim().split("\n");
  const head = lines[0].replace(/^#/, "").trim().split(/\s+/);
  const row = lines.slice(2).find((l) => l.trim()) || "";
  const vals = row.trim().split(/\s+/);
  const o = {};
  head.forEach((h, i) => (o[h] = vals[i] === "MM" ? null : vals[i]));
  const time = o.YY ? `${o.YY}-${o.MM}-${o.DD}T${o.hh}:${o.mm}:00Z` : null;
  const num = (k) => (o[k] == null ? null : Number(o[k]));
  return {
    time, windDirDeg: num("WDIR"), windMs: num("WSPD"), gustMs: num("GST"), waveM: num("WVHT"),
    wavePeriodS: num("DPD"), airC: num("ATMP"), waterC: num("WTMP"), pressureHpa: num("PRES"),
  };
}
async function updateLake() {
  const out = { updated: now(), stations: {} };
  for (const [id, name] of [["DULM5", "Duluth (canal)"], ["45028", "Western Lake Superior buoy"], ["45027", "North of Duluth buoy"]]) {
    try { out.stations[id] = { name, ...parseNdbc(await getText(`https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`)) }; }
    catch (e) { console.log(`NDBC ${id}:`, e.message); }
  }
  if (!Object.keys(out.stations).length) throw new Error("no lake stations reachable");
  return out;
}

// --- Live camera list (YouTube) ----------------------------------------------
async function updateCams() {
  const html = await getText("https://www.youtube.com/@DuluthHarborCam1/streams", {
    headers: { "Accept-Language": "en-US", "User-Agent": "Mozilla/5.0" },
  });
  const cams = [];
  const seen = new Set();
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"(.{0,4000}?)"title":\{"runs":\[\{"text":"([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const [, id, , title] = m;
    const chunk = html.slice(m.index, m.index + 6000);
    const live = /LIVE_NOW|"style":"LIVE"|"label":"LIVE"/.test(chunk);
    if (live && !seen.has(id)) { seen.add(id); cams.push({ youtube: id, title: title.replace(/\\u0026/g, "&") }); }
  }
  return { updated: now(), cams };
}

// --- Posted schedule --------------------------------------------------------------
// Canal Park's schedule page embeds Harbor Lookout, and so does this app.
// Log whether Harbor Lookout allows being shown inside other sites.
async function checkScheduleEmbed() {
  const res = await fetch("https://harborlookout.com/", { signal: AbortSignal.timeout(15000) });
  console.log("Harbor Lookout:", res.status, "x-frame-options:", res.headers.get("x-frame-options") || "(none)",
    "| frame-ancestors:", (res.headers.get("content-security-policy") || "").match(/frame-ancestors[^;]*/)?.[0] || "(none)");
}

// --- Run everything ------------------------------------------------------------
async function main() {
  await mkdir(OUT, { recursive: true });
  await checkScheduleEmbed().catch((e) => console.log("Harbor Lookout check failed:", e.message));
  const jobs = { "ships.json": updateShips, "current.json": updateCurrent, "lake.json": updateLake, "cams.json": updateCams };
  const results = await Promise.allSettled(Object.values(jobs).map((fn) => fn()));
  const names = Object.keys(jobs);
  for (let i = 0; i < names.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && r.value) {
      await writeFile(`${OUT}/${names[i]}`, JSON.stringify(r.value));
      console.log(`Wrote ${names[i]}`);
    } else {
      console.log(`Could not update ${names[i]}: ${r.reason?.message || "no data"}`);
      const prev = await loadPrevious(names[i]); // keep last good copy online
      if (prev) await writeFile(`${OUT}/${names[i]}`, JSON.stringify(prev));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
