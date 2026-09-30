// Free photos from Wikimedia Commons (with credit), cached in the browser.
const API = "https://commons.wikimedia.org/w/api.php";
const strip = (html) => String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

function cacheGet(key) {
  try { const v = JSON.parse(localStorage.getItem("cp.photo." + key)); if (v && v.exp > Date.now()) return v; } catch {}
  return null;
}
function cacheSet(key, data, days) {
  try { localStorage.setItem("cp.photo." + key, JSON.stringify({ ...data, exp: Date.now() + days * 864e5 })); } catch {}
}

async function search(query, limit = 10) {
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrsearch: query,
    gsrnamespace: "6", gsrlimit: String(limit), prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: "800",
  });
  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(12000) });
  const d = await res.json();
  return Object.values(d.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .map((p) => {
      const ii = p.imageinfo?.[0] || {};
      const m = ii.extmetadata || {};
      return {
        title: p.title, url: ii.thumburl || ii.url, page: ii.descriptionurl, mime: ii.mime,
        artist: strip(m.Artist?.value), license: strip(m.LicenseShortName?.value),
        caption: strip(m.ImageDescription?.value || m.ObjectName?.value), date: strip(m.DateTimeOriginal?.value || m.DateTime?.value).slice(0, 10),
      };
    })
    .filter((p) => p.url && /jpe?g|png/i.test(p.mime || p.url));
}

const words = (s) => String(s).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1);

// Best-guess photo of a ship by name. Returns null if nothing convincing.
export async function shipPhoto(name) {
  if (!name) return null;
  const key = "ship." + name.toUpperCase();
  const hit = cacheGet(key);
  if (hit) return hit.url ? hit : null;
  let found = null;
  try {
    const need = words(name);
    const results = await search(`"${name}" ship`, 8);
    // Every word of the ship's name must appear in the file name.
    found = results.find((r) => { const t = words(r.title).join(" "); return need.every((w) => t.includes(w)); }) || null;
  } catch { return null; }
  cacheSet(key, found || {}, found ? 14 : 3);
  return found;
}

// A different Duluth harbor photo every day.
export async function photoOfTheDay() {
  const day = Math.floor((Date.now() - 6 * 3600e3) / 864e5);
  const hit = cacheGet("potd." + day);
  if (hit) return hit;
  const queries = ['"Aerial Lift Bridge" Duluth', "Duluth ship canal", "Duluth harbor ship", "Canal Park Duluth lighthouse"];
  const q = queries[day % queries.length];
  const results = await search(q, 40);
  if (!results.length) return null;
  const pick = results[Math.floor(day / queries.length) % results.length];
  cacheSet("potd." + day, pick, 1);
  return pick;
}
