# Canal Park Virtual Visitor Center

A web app that brings Canal Park in Duluth, MN to any phone or computer:

- **Live cameras** from Duluth Harbor Cam (1, 2 or 4 at once, and you can pick or add streams)
- **Marine radio** from the Duluth-Superior Harbor Marine Traffic feed, with play, volume and mute
- **Canal current** from the USGS sensor in the ship canal, drawn as the Aerial Lift Bridge's red/amber/green light, with a small animation of the water's flow
- **Weather** from the National Weather Service: current conditions, the next few hours, alerts and the Duluth radar loop
- **Ship traffic**: which ships are approaching, on the move or at anchor, a log of passages under the bridge, a live map, and the posted schedule from [Harbor Lookout](https://harborlookout.com/), the same one [Canal Park's schedule page](https://canalpark.com/duluth-ship-schedule/) shows
- **Alerts** for arrivals and departures, or only your favorite ships (by name, MMSI/AIS number or IMO number)
- **Next ship at the bridge**: a live countdown to the next arrival or departure, with the ship's photo, length, flag, and usual cargo or loaded/empty status
- **Ship & camera map**: the approximate view of each camera, so you can tell which ship you're looking at. Camera tiles label the ships in view, and "Watch on camera" jumps to the right stream.
- **Ship profiles**: tap any ship name for a photo, specs, destination and links
- **Lake conditions**: water temperature, waves, wind, harbor level, sunrise and sunset, golden hour, moonrise and moon phase
- **Visitor center guide**: the bridge, ship types, horn signals (tap to hear each one), the current light, and ship-watching tips
- **Extras**: harbor photo of the day, ship-horn salutes and foghorn sounds, and harbor facts

---

## How it works (plain language)

| Part | What it is |
|---|---|
| `index.html`, `css/`, `js/` | The website itself. It runs entirely in your browser. |
| `js/config.js` | **Settings you can edit**: cameras, radio feed, schedule links. |
| `config/alerts.json` | **Your favorite ships** for phone alerts when the app is closed. |
| `scripts/` | The *updater*, a small program GitHub runs for free about every 10 minutes. It listens to ship radio beacons (AIS) near Duluth, works out who's arriving or leaving, sends alerts, and saves the results in `data/`. |
| `.github/workflows/` | The schedule that tells GitHub to run the updater and publish the site. |
| `tests/` | Automatic checks that the ship-tracking logic works. |

Everything uses free services.

---

## One-time setup (about 15 minutes, no coding)

### 1. Make the repository public
GitHub only hosts websites and runs frequent scheduled jobs for free on **public** repositories.
Nothing secret is stored in the code. Your keys go in step 3, where they stay hidden.

GitHub → this repository → **Settings** → scroll to the bottom → **Change visibility** → **Public**.

> If you'd rather keep it private, a GitHub Pro plan ($4/month) is needed.

### 2. Turn on the website (GitHub Pages)
**Settings** → **Pages** → under *Build and deployment*, set **Source** to **GitHub Actions**.

### 3. Get a free ship-tracking key
1. Go to <https://aisstream.io>, sign in with GitHub, and create an **API key**.
2. In this repository: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `AISSTREAM_API_KEY`  Value: *(paste the key)*

### 4. (Optional) Phone alerts while the app is closed
1. Make up a hard-to-guess topic name, e.g. `canalpark-will-7x3k9`. Anyone who knows it can see your alerts.
2. Add another secret: Name `NTFY_TOPIC`, Value *your topic name*.
3. Install the free **ntfy** app on your phone and subscribe to one or more of:
   - `yourtopic-all`: every arrival and departure
   - `yourtopic-arrivals`: ships approaching and arriving
   - `yourtopic-departures`: ships heading out and leaving
   - `yourtopic-favorites`: only ships listed in `config/alerts.json`

   Friends and family can subscribe to the same topics.

### 5. Start it
**Actions** tab → **Update data and publish site** → **Run workflow**.
After 3–4 minutes your site is live at the address shown under **Settings → Pages**
(something like `https://monson67.github.io/Duluth-Harbor/`).

### 6. Put it on your iPhone
Open the site in **Safari** → **Share** → **Add to Home Screen**. Open it from the home screen,
tap the bell 🔔, and choose **Turn on notifications** for alerts while the app is open.

---

## Everyday changes

- **Add a camera:** in the app, tap **Manage cameras** and paste a YouTube link from
  [Duluth Harbor Cam's streams](https://www.youtube.com/@DuluthHarborCam1/streams).
  The updater also tries to find the streams that are currently live and adds them to each camera's menu.
- **Favorite ships in the app:** tap ☆ next to a ship, or add one in 🔔 settings.
- **Favorite ships for closed-app alerts:** edit `config/alerts.json` on GitHub (pencil icon → **Commit changes**).
- **Ship facts (usual cargo, fun notes, your own photos):** edit `config/fleet.json`. Ship broadcasts (AIS) don't include cargo, so this list fills the gap.
- **Camera view areas on the map:** in `js/config.js` under `cameraSpots`. Each camera's position, direction (`bearing`), width (`fov`) and distance (`range`) are approximate. Nudge them if the "in view" labels don't match what you see.

## Good to know

- **Ship alerts are approximate.** The updater checks about every 10 minutes (each run starts the next, since GitHub runs scheduled jobs late),
  so "approaching" alerts usually come 20–90 minutes before a ship reaches the canal, and "arrived"/"departed" alerts come shortly after.
- **Ship photos** come from Wikimedia Commons when a matching photo exists, with credit shown on the photo. Lesser-known ships may show a drawing instead.
- **The current light is our recreation** of the bridge's signal, based on USGS readings
  (positive = flowing out to the lake). It isn't the bridge's actual light.
- **The radio stream** comes from Broadcastify, and a short ad may play first. This is fine for personal use.
  Ask Broadcastify before sharing it publicly.
- GitHub pauses scheduled jobs after **60 days without changes** to a public repository. If data stops updating,
  open the **Actions** tab and click **Enable workflow**, or make any small edit.
- This isn't a navigation aid.

## For developers
- Tests: `node --test tests/*.test.mjs`
- Local preview: `python3 -m http.server` in this folder, then open <http://localhost:8000>
- Test the updater without internet: `AIS_URL=ws://localhost:8765` points it at a fake AIS feed
