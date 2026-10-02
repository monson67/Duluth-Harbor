// Live ship positions for the Canal Park Visitor Center (Cloudflare Worker).
//
// aisstream.io doesn't allow web pages to connect directly, so this small
// helper holds the connection and hands the site a fresh snapshot of ship
// positions. To stay well inside Cloudflare's free plan it only listens while
// someone has the site open: the first visitor wakes it, and it hangs up
// about 10 minutes after the last visitor leaves.
//
// The site falls back to the regular 10-minute data whenever this is down.

import { WATCH_BOX, applyMessage } from "../scripts/harbor.mjs";

const IDLE_MS = 10 * 60e3;   // hang up after this long with no visitors
const STALE_MS = 5 * 60e3;   // reconnect if aisstream goes quiet this long
const KEEP_MS = 30 * 60e3;   // drop ships not heard from in this long
const TICK_MS = 30e3;        // how often the helper checks on itself
const FIELDS = ["mmsi", "name", "lat", "lon", "sog", "cog", "heading", "navStatus", "lastSeen",
  "type", "length", "beam", "draught", "imo", "callsign", "destination", "aisEta"];

export class Feed {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.vessels = {};
    this.ws = null;
    this.lastMessage = 0;
    this.lastVisitor = 0;
    this.connecting = null;
    this.stats = { since: new Date().toISOString(), connects: 0, messages: 0, lastError: null };
  }

  async fetch() {
    this.lastVisitor = Date.now();
    await this.keepAlive();
    const cutoff = Date.now() - KEEP_MS;
    const vessels = Object.values(this.vessels)
      .filter((v) => v.lat != null && Date.parse(v.lastSeen) > cutoff)
      .map((v) => Object.fromEntries(FIELDS.filter((k) => v[k] != null).map((k) => [k, v[k]])));
    return Response.json({ updated: new Date().toISOString(), connected: !!this.ws, stats: this.stats, vessels });
  }

  async alarm() {
    if (Date.now() - this.lastVisitor > IDLE_MS) { this.hangUp(); return; } // nobody watching
    await this.keepAlive();
  }

  async keepAlive() {
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
    if (!this.ws || Date.now() - this.lastMessage > STALE_MS) await this.connect();
  }

  async connect() {
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      this.hangUp();
      try {
        const res = await fetch("https://stream.aisstream.io/v0/stream", { headers: { Upgrade: "websocket" } });
        const ws = res.webSocket;
        if (!ws) throw new Error(`no websocket (HTTP ${res.status})`);
        ws.accept();
        ws.send(JSON.stringify({
          APIKey: this.env.AISSTREAM_API_KEY,
          BoundingBoxes: [WATCH_BOX],
          FilterMessageTypes: ["PositionReport", "ShipStaticData", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "StaticDataReport"],
        }));
        ws.addEventListener("message", async (ev) => {
          try {
            const d = ev.data;
            const text = typeof d === "string" ? d : typeof d?.text === "function" ? await d.text() : new TextDecoder().decode(d);
            const m = JSON.parse(text);
            if (m.error) { console.log("aisstream error:", m.error); this.stats.lastError = String(m.error); this.hangUp(); return; }
            applyMessage(this.vessels, m, new Date().toISOString());
            this.lastMessage = Date.now();
            this.stats.messages++;
          } catch (err) { this.stats.lastError = err.message; }
        });
        const gone = (ev) => { if (ev?.code) this.stats.lastError = `closed ${ev.code} ${ev.reason || ""}`.trim(); if (this.ws === ws) this.ws = null; };
        ws.addEventListener("close", gone);
        ws.addEventListener("error", gone);
        this.ws = ws;
        this.stats.connects++;
        this.lastMessage = Date.now(); // give it a grace period before calling it stale
      } catch (err) {
        console.log("connect failed:", err.message);
        this.stats.lastError = err.message;
      } finally {
        this.connecting = null;
      }
    })();
    return this.connecting;
  }

  hangUp() {
    try { this.ws?.close(1000, "idle"); } catch {}
    this.ws = null;
  }
}

// Visitors share one snapshot per few seconds, so a crowd costs no more
// helper time than one person.
let cached = null;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "*",
      "Access-Control-Allow-Methods": "GET",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname !== "/live") return new Response("Canal Park live ship positions: see /live", { headers: cors });

    if (!cached || Date.now() - cached.at > 8e3) {
      const stub = env.FEED.get(env.FEED.idFromName("lake-superior"));
      const res = await stub.fetch("https://feed/live");
      cached = { at: Date.now(), body: await res.text() };
    }
    return new Response(cached.body, {
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=8" },
    });
  },
};
