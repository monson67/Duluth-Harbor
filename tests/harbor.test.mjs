// Run with: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { inHarbor, processUpdate, matchesFavorites, bearing, ENTRIES, eventText } from "../scripts/harbor.mjs";

test("harbor vs lake classification", () => {
  assert.equal(inHarbor(46.7825, -92.0800), false, "just off the canal piers is lake");
  assert.equal(inHarbor(46.7800, -92.1000), true, "Duluth harbor by the DECC");
  assert.equal(inHarbor(46.7230, -92.0600), true, "Superior harbor");
  assert.equal(inHarbor(46.7400, -92.0700), true, "Superior Bay behind Park Point");
  assert.equal(inHarbor(46.7500, -92.0400), false, "lake off Park Point beach");
  assert.equal(inHarbor(46.9000, -91.8000), false, "open lake toward Two Harbors");
});

const pos = (mmsi, name, lat, lon, sog, cog) => ({
  MessageType: "PositionReport",
  MetaData: { MMSI: mmsi, ShipName: name + "    ", latitude: lat, longitude: lon },
  Message: { PositionReport: { Latitude: lat, Longitude: lon, Sog: sog, Cog: cog, TrueHeading: Math.round(cog), NavigationalStatus: 0 } },
});
const stat = (mmsi, name) => ({
  MessageType: "ShipStaticData",
  MetaData: { MMSI: mmsi, ShipName: name },
  Message: { ShipStaticData: { Name: name + "@@@@", ImoNumber: 7625952, Type: 70, Dimension: { A: 250, B: 55, C: 16, D: 16 }, Destination: "DULUTH", Eta: { Month: 10, Day: 1, Hour: 6, Minute: 0 } } },
});

test("ship approaching, then arriving through the Duluth canal", () => {
  const t1 = "2026-09-30T12:00:00Z";
  const lat = 46.83, lon = -92.00; // ~5 nm out in the lake, northeast of the canal
  const cog = bearing(lat, lon, ENTRIES.duluth.lat, ENTRIES.duluth.lon);
  let s = processUpdate(null, [stat(366000001, "EDWIN H. GOTT"), pos(366000001, "EDWIN H. GOTT", lat, lon, 10, cog)], t1);
  const v = s.vessels["366000001"];
  assert.equal(v.name, "EDWIN H. GOTT");
  assert.equal(v.zone, "lake");
  assert.equal(v.approachEntry, "duluth");
  assert.ok(v.etaMinutes > 20 && v.etaMinutes < 45, `eta ${v.etaMinutes}`);
  assert.equal(Math.round(v.length * 3.281), 1001);
  assert.deepEqual(s.newEvents.map((e) => e.type), ["approaching"]);

  // Ten minutes later, same heading: no duplicate alert.
  s = processUpdate(s, [pos(366000001, "EDWIN H. GOTT", 46.81, -92.04, 9, cog)], "2026-09-30T12:10:00Z");
  assert.deepEqual(s.newEvents, []);

  // Now inside the harbor.
  s = processUpdate(s, [pos(366000001, "EDWIN H. GOTT", 46.7770, -92.1000, 4, 250)], "2026-09-30T12:40:00Z");
  assert.deepEqual(s.newEvents.map((e) => [e.type, e.entry]), [["arrived", "duluth"]]);
  assert.equal(s.vessels["366000001"].lastCanalPassage.direction, "inbound");
  assert.equal(s.events.length, 2);
  assert.match(eventText(s.newEvents[0]).body, /Duluth Ship Canal/);
});

test("ship leaving through the Superior Entry", () => {
  const lat = 46.720, lon = -92.030;
  const cog = bearing(lat, lon, ENTRIES.superior.lat, ENTRIES.superior.lon);
  let s = processUpdate(null, [stat(1, "AMERICAN SPIRIT"), pos(1, "AMERICAN SPIRIT", lat, lon, 6, cog)], "2026-09-30T12:00:00Z");
  assert.equal(s.vessels["1"].zone, "harbor");
  assert.deepEqual(s.newEvents.map((e) => [e.type, e.entry]), [["departing", "superior"]]);
  s = processUpdate(s, [pos(1, "AMERICAN SPIRIT", 46.700, -91.980, 9, 100)], "2026-09-30T12:15:00Z");
  assert.deepEqual(s.newEvents.map((e) => [e.type, e.entry]), [["departed", "superior"]]);
});

test("pleasure boats don't create events, stale ships are dropped", () => {
  const boat = pos(2, "SUNNY DAYS", 46.83, -92.00, 8, 240);
  const st = { MessageType: "ShipStaticData", MetaData: { MMSI: 2 }, Message: { ShipStaticData: { Name: "SUNNY DAYS", Type: 37, Dimension: { A: 5, B: 5, C: 2, D: 2 } } } };
  let s = processUpdate(null, [st, boat], "2026-09-30T12:00:00Z");
  assert.deepEqual(s.newEvents, []);
  s = processUpdate(s, [], "2026-10-01T08:00:00Z");
  assert.equal(s.vessels["2"], undefined);
});

test("favorites match by name, MMSI or IMO", () => {
  const e = { name: "Edwin H. Gott", mmsi: 366000001 };
  assert.ok(matchesFavorites(e, {}, ["EDWIN H. GOTT"]));
  assert.ok(matchesFavorites(e, {}, ["366000001"]));
  assert.ok(matchesFavorites(e, { imo: 7625952 }, ["7625952"]));
  assert.ok(!matchesFavorites(e, {}, ["ROGER BLOUGH", ""]));
});

test("far-off ship bound for Duluth is tracked, alert waits until it's close", async () => {
  const { loadState, flagOf } = await import("../scripts/harbor.mjs");
  const lat = 47.0, lon = -91.3; // ~35 nm out in the lake
  const cog = bearing(lat, lon, ENTRIES.duluth.lat, ENTRIES.duluth.lon) + 20;
  const s = processUpdate(null, [stat(316000002, "BAIE ST. PAUL"), pos(316000002, "BAIE ST. PAUL", lat, lon, 12, cog)], "2026-09-30T12:00:00Z");
  const v = s.vessels["316000002"];
  assert.equal(v.approachEntry, "duluth");
  assert.ok(v.etaMinutes > 150, `eta ${v.etaMinutes}`);
  assert.deepEqual(s.newEvents, [], "no alert ~3 hours out");
  assert.equal(flagOf(v.mmsi).country, "Canada");
  assert.equal(loadState({ length: 300, draught: 8.2 }).loaded, true);
  assert.equal(loadState({ length: 300, draught: 4.5 }).loaded, false);
  assert.equal(loadState({ length: 20, draught: 2 }), null);
});
