// ---------------------------------------------------------------------------
// Canal Park Virtual Visitor Center — settings you can safely edit.
// Anything between quotes can be changed. Save the file and reload the page.
// ---------------------------------------------------------------------------

window.CANAL_CONFIG = {
  // Where "Canal Park" is (the Aerial Lift Bridge).
  location: { name: "Canal Park, Duluth MN", lat: 46.7790, lon: -92.0926 },

  // Live cameras. Each one is a YouTube stream from Duluth Harbor Cam.
  // To add one: open the stream on YouTube, copy the link, and use the
  // "Manage cameras" button in the app (no file editing needed).
  // "channel" entries always show that channel's current featured live stream.
  cameras: [
    { title: "Duluth Harbor Cam — featured live", channel: "UCzkaQrI9-nSv373EvK5p0SQ", spot: "none" },
    { title: "Canal Cam", youtube: "HPS48TMmNag" },
    { title: "Ship Cam at Canal Park", youtube: "f0YRWpQTxNU" },
  ],
  cameraChannelPage: "https://www.youtube.com/@DuluthHarborCam1/streams",

  // Where each camera sits and roughly which way it points, so the map can
  // show what it sees and label ships "in view". A camera is linked to a
  // spot when its title contains the spot's "match" word(s).
  // bearing = compass direction the camera faces (0 = north, 90 = east),
  // fov = how wide it sees in degrees, range = how far in nautical miles.
  // These are APPROXIMATE. Adjust them if a camera's view looks off.
  cameraSpots: [
    { key: "canal", name: "Canal Cam", match: "canal|ship cam", lat: 46.7794, lon: -92.0912, bearing: 70, fov: 80, range: 4 },
    { key: "bridge", name: "Bridge Cam", match: "bridge", lat: 46.7794, lon: -92.0912, bearing: 245, fov: 60, range: 1.5 },
    { key: "southpier", name: "South Pier Lighthouse Cam", match: "south pier|lighthouse", lat: 46.7788, lon: -92.0887, bearing: 65, fov: 110, range: 6 },
    { key: "harbor", name: "Harbor Cam", match: "harbor cam|hillside|bayfront|pier b|gla", lat: 46.7780, lon: -92.1060, bearing: 100, fov: 90, range: 2.5 },
    { key: "wipoint", name: "Wisconsin Point Cam", match: "wisconsin point|superior entry", lat: 46.7115, lon: -92.0040, bearing: 300, fov: 120, range: 4 },
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
  // Extra info about well-known ships (usual cargo, photos, notes).
  fleetUrl: "config/fleet.json",

  // Posted ship schedule: Harbor Lookout, the same schedule Canal Park's
  // ship-schedule page shows. It appears inside the app's "Posted schedule" tab.
  scheduleSource: { name: "Harbor Lookout", url: "https://harborlookout.com/" },
  scheduleLinks: [
    { name: "Canal Park ship schedule page", url: "https://canalpark.com/duluth-ship-schedule/" },
    { name: "VesselFinder — Port of Duluth", url: "https://www.vesselfinder.com/ports/USDLH001" },
  ],
};
