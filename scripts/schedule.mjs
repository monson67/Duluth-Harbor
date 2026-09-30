// Reads a posted ship schedule (HTML page) into rows the app can show.
// It doesn't assume particular column names: it finds the largest table
// on the page (or in an embedded frame) and keeps its header and rows.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”" };
export function text(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTables(html) {
  const tables = [];
  for (const t of String(html).matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows = [];
    for (const tr of t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = [...tr[0].matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => ({ head: c[1].toLowerCase() === "th", text: text(c[2]) }));
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

// Pick the biggest table and split it into header + body rows.
export function scheduleFromHtml(html) {
  const tables = parseTables(html).sort((a, b) => b.length - a.length);
  const t = tables[0];
  if (!t || t.length < 2) return null;
  let header = null;
  if (t[0].every((c) => c.head) || t[0].some((c) => c.head)) header = t[0].map((c) => c.text);
  const body = (header ? t.slice(1) : t).map((r) => r.map((c) => c.text)).filter((r) => r.some((x) => x));
  if (!header) header = body[0].map((_, i) => `Column ${i + 1}`);
  return { header, rows: body };
}

// A short description of the page's structure, printed in the updater log
// so the reader can be tuned without guessing.
export function describePage(html) {
  const s = String(html);
  const pick = (re, n = 8) => [...s.matchAll(re)].slice(0, n).map((m) => m[1]);
  return {
    length: s.length,
    title: text((s.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || ""),
    tables: parseTables(s).map((t) => ({ rows: t.length, first: t.slice(0, 3).map((r) => r.map((c) => c.text).join(" | ")) })),
    iframes: pick(/<iframe[^>]+src=["']([^"']+)/gi),
    scripts: pick(/<script[^>]+src=["']([^"']+)/gi, 25).filter((x) => !/jquery|wp-includes|google|facebook|analytics|gtag|pixel/i.test(x)),
    dataHints: pick(/((?:https?:)?\/\/[^"'\s]+(?:\.json|\/api\/|admin-ajax\.php|wp-json)[^"'\s]*)/gi),
    textSample: text(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")).match(/.{0,300}(?:arriv|depart|vessel|ETA)[\s\S]{0,600}/i)?.[0] || "",
  };
}

export async function fetchSchedule(url, getText) {
  const html = await getText(url);
  const info = describePage(html);
  console.log("SCHEDULE PAGE:", JSON.stringify(info, null, 1).slice(0, 6000));
  let sched = scheduleFromHtml(html);
  // If the schedule lives in an embedded frame, read that too.
  if (!sched) {
    for (const src of info.iframes) {
      try {
        const u = new URL(src, url).href;
        const inner = await getText(u);
        console.log("SCHEDULE FRAME:", u, JSON.stringify(describePage(inner), null, 1).slice(0, 4000));
        sched = scheduleFromHtml(inner);
        if (sched) break;
      } catch (e) { console.log("frame failed:", src, e.message); }
    }
  }
  if (!sched) throw new Error("no schedule table found on the page");
  return sched;
}
