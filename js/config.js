// ---------------------------------------------------------------------------
// Canal Park Virtual Visitor Center — settings you can safely edit.
// Anything between quotes can be changed. Save the file and reload the page.
// ---------------------------------------------------------------------------

window.CANAL_CONFIG = {
  // Where "Canal Park" is (the Aerial Lift Bridge).
  location: { name: "Canal Park, Duluth MN", lat: 46.7790, lon: -92.0926 },

  // Live cameras, grouped by location, from the Lake Superior Marine Museum
  // Association's Web Cams page (https://www.lsmma.com, Boat Watchers → Web Cams).
  // Each location's list is in priority order: the 1st camera is the main view
  // (and the first of the 2- and 4-camera views), the 2nd–4th fill the other
  // views, and the rest follow in the dropdown in this order.
  //   camstreamer = the museum's stream link; the updater follows it to the
  //                 current YouTube stream each run, so restarted streams keep working
  //   youtube     = last known YouTube stream (used until the updater checks)
  //   spot        = where the camera sits on the map (see cameraSpots below), for
  //                 the "ships in view" labels; leave it out if unknown
  cameraLocations: [
    { key: "duluth", name: "Duluth Harbor", cams: [
      { key: "canal", title: "Canal Cam", camstreamer: "tyxooOqos1LX6pvVwLo7YYCFjebUYSfKRGovD3VP", youtube: "HPS48TMmNag", spot: "canal" },
      { key: "bridge", title: "Bridge Cam", camstreamer: "rc9ESJv9JfnHHXGhtan3R70A85RrOZUIjiA0Y6Vg", youtube: "36MiI7NltHk", spot: "bridge" },
      { key: "bayfront", title: "Bayfront Cam", camstreamer: "u3a9TNe05qcM4qK6Yza0Om5JczJmeBqEiHhyY8OS", youtube: "EbVlhVeD3jA", spot: "harbor" },
      { key: "lighthouse", title: "Lighthouse Cam", camstreamer: "lDZY136tEMlHXuVDNpBjt5klRIZfjIXE9I7e7tXX", youtube: "nCf7X2cPDAY", spot: "lighthouse" },
      { key: "hillside", title: "Hillside Cam", camstreamer: "iJ04DdtUqAILdENBaiQbAng9zac4j1igTvhHwJQQ", youtube: "DzJb26edNjs", spot: "harbor" },
      { key: "southpier", title: "South Pier Lighthouse Cam", camstreamer: "GVCSDDlxgIH6zkiNVlvQ4acQY080qKDKW3HR0uJb", youtube: "Pij4VMrNMFY", spot: "southpier" },
      { key: "gla", title: "GLA Cam", camstreamer: "vnpbuwO8ijoqqGF7cQpP3YLiwihrwlgbbK17GHlN", youtube: "bBubIPZYVt0", spot: "harbor" },
      { key: "pierb", title: "Pier B Cam", camstreamer: "omtBz7h244PIqjMrwI8xDV6DynIb4G4jwNTdZaEE", youtube: "c1kfkIoF0k0", spot: "harbor" },
      { key: "harborcam", title: "Harborcam", camstreamer: "i2mkqi3dioZzrrKwRBE62MsKV6R924qftGGZydZT", youtube: "05WivhRmKq4", spot: "harbor" },
      { key: "ami", title: "AMI Cam (Connors Point)", camstreamer: "LiW55Uwdn7MJFRoV9WwDmw5OhfZTei9pfu4na2zT", youtube: "_L0u39B732I", spot: "ami" },
      { key: "western", title: "Western Harbor Cam", camstreamer: "dobXHszVj7SO8PKux3qBl7zj0VO3lr0NZRE5nM2j", youtube: "", spot: "western" },
      { key: "beach", title: "Beach Cam (Solglimt B&B)", youtube: "m2wWzo9GmwY", spot: "beach" },
    ] },
    { key: "superior", name: "Superior", cams: [
      { key: "wipoint", title: "Wisconsin Point Cam", camstreamer: "UOgeYRAKSV5tYyRvLJgQUsbUaTp3umy798h32PXM", youtube: "i2rSgt5t_p4", spot: "wipoint" },
    ] },
    { key: "twoharbors", name: "Two Harbors", cams: [
      { key: "thdepot", title: "Two Harbors Depot", camstreamer: "d31e385b9f6d113/S-26230", youtube: "rCec9HDbFwA", spot: "thdepot" },
      { key: "thlaunch", title: "Two Harbors Boat Launch", camstreamer: "fPBkxzxaLYIDM1b2zrEm4JgTzHeTS3sQ9puI6tfk", youtube: "sThx7mQM3Uc", spot: "thlaunch" },
    ] },
    { key: "splitrock", name: "Split Rock", cams: [
      { key: "splitrock", title: "Split Rock Lighthouse", camstreamer: "Gc7nmBAXKQSlZlj1OIjLZwc92fzgek0zSoQdbCmK", youtube: "9EnmgL3fXW8", spot: "splitrock" },
    ] },
    { key: "silverbay", name: "Silver Bay", cams: [
      { key: "silverbay", title: "Silver Bay Marina", camstreamer: "06b000052e8f80f/S-24949", youtube: "zTVWJ3Mc0Ag", spot: "silverbay" },
    ] },
  ],
  cameraSourcePage: "https://www.lsmma.com/content.aspx?page_id=22&club_id=605134&module_id=524613",

  // Where each camera sits and roughly which way it points, so the map can
  // show what it sees and label ships "in view". Cameras link to these by
  // their "spot". bearing = compass direction the camera faces (0 = north,
  // 90 = east), fov = how wide it sees in degrees, range = how far in nautical
  // miles. These are APPROXIMATE. Adjust them if a camera's view looks off.
  cameraSpots: [
    { key: "canal", name: "Canal Cam", lat: 46.7794, lon: -92.0912, bearing: 70, fov: 80, range: 4 },
    { key: "bridge", name: "Bridge Cam", lat: 46.7794, lon: -92.0912, bearing: 245, fov: 60, range: 1.5 },
    { key: "lighthouse", name: "Lighthouse Cam", lat: 46.7799, lon: -92.0923, bearing: 75, fov: 60, range: 4 },
    { key: "southpier", name: "South Pier Lighthouse Cam", lat: 46.7788, lon: -92.0887, bearing: 65, fov: 110, range: 6 },
    { key: "harbor", name: "Harbor cams (Bayfront, Hillside, GLA, Pier B, Harborcam)", lat: 46.7780, lon: -92.1060, bearing: 100, fov: 90, range: 2.5 },
    { key: "ami", name: "AMI Cam (Connors Point)", lat: 46.7472, lon: -92.0981, bearing: 20, fov: 120, range: 2 },
    { key: "western", name: "Western Harbor Cam", lat: 46.7627, lon: -92.1493, bearing: 90, fov: 100, range: 3 },
    { key: "beach", name: "Beach Cam", lat: 46.7764, lon: -92.0908, bearing: 90, fov: 120, range: 4 },
    { key: "wipoint", name: "Wisconsin Point Cam", lat: 46.7115, lon: -92.0040, bearing: 300, fov: 120, range: 4 },
    { key: "thdepot", name: "Two Harbors Depot", lat: 47.0188, lon: -91.6693, bearing: 130, fov: 100, range: 6 },
    { key: "thlaunch", name: "Two Harbors Boat Launch", lat: 47.0154, lon: -91.6651, bearing: 120, fov: 120, range: 3 },
    { key: "splitrock", name: "Split Rock Lighthouse", lat: 47.1999, lon: -91.3669, bearing: 45, fov: 90, range: 4 },
    { key: "silverbay", name: "Silver Bay Marina", lat: 47.2717, lon: -91.2748, bearing: 120, fov: 120, range: 3 },
  ],

  // Duluth-Superior Harbor Marine Traffic scanner (Broadcastify feed 37404).
  radio: {
    name: "Duluth-Superior Harbor Marine Traffic",
    streamUrl: "https://broadcastify.cdnstream1.com/37404",
    pageUrl: "https://www.broadcastify.com/listen/feed/37404",
  },

  // U.S. Geological Survey water-speed sensor in the ship canal.
  usgsSite: "464646092052900",

  // National Weather Service: weather station on Park Point (Sky Harbor
  // airport, closest to the canal) and the Duluth radar.
  weather: {
    station: "KDYT",
    fallbackStation: "KDLH",
    radarLoop: "https://radar.weather.gov/ridge/standard/KDLH_loop.gif",
  },

  // NOAA water-level gauge in the Duluth harbor.
  noaaWaterStation: "9099064",

  // Where the ship data is published by the background updater. Leave as-is.
  shipsDataUrl: "data/ships.json",
  // Live ship positions from the Cloudflare helper (see live/worker.mjs).
  // To turn live positions off, change this to "" and the site goes back to
  // the 10-minute updates.
  liveUrl: "https://canal-park-live.canal-park-live.workers.dev/live",
  // Ship schedule (Harbor Lookout): the copy the updater saves at noon and
  // midnight, and the helper address the schedule's refresh button uses.
  scheduleDataUrl: "data/schedule.json",
  scheduleRefreshUrl: "https://canal-park-live.canal-park-live.workers.dev/schedule",
  // Extra info about well-known ships (usual cargo, photos, notes).
  fleetUrl: "config/fleet.json",

  // Harbor tour boats, matched by name. Ship radio beacons don't say "tour
  // boat", so list them here to give them their own shape on the map.
  tourBoats: ["VISTA STAR", "VISTA QUEEN"],

};
