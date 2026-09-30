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
    { title: "Duluth Harbor Cam — featured live", channel: "UCzkaQrI9-nSv373EvK5p0SQ" },
    { title: "Canal Cam", youtube: "HPS48TMmNag" },
    { title: "Ship Cam at Canal Park", youtube: "f0YRWpQTxNU" },
  ],
  cameraChannelPage: "https://www.youtube.com/@DuluthHarborCam1/streams",

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

  // Official / community schedule pages (opened in a new tab).
  scheduleLinks: [
    { name: "Duluth Harbor Cam boat schedule", url: "https://www.duluthharborcam.com/p/boat-schedules.html" },
    { name: "Canal Park ship schedule", url: "https://canalpark.com/duluth-ship-schedule/" },
    { name: "Lake Superior Marine Museum Assoc.", url: "https://lsmma.com/content.aspx?page_id=22&club_id=605134&module_id=524305" },
    { name: "VesselFinder — Port of Duluth", url: "https://www.vesselfinder.com/ports/USDLH001" },
  ],
};
