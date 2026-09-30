// Visitor-center guide text and quick facts. Edit freely; plain HTML.

export const GUIDE = {
  bridge: `
    <p>The <b>Aerial Lift Bridge</b> is Duluth's landmark and the gateway between Lake Superior and the harbor.</p>
    <h4>A bridge that changed shape</h4>
    <p>It opened in <b>1905</b> as America's first <b>transporter bridge</b>: a gondola hung from the top truss and carried people,
      wagons and streetcars across the canal. As traffic grew, it was rebuilt in <b>1929–30</b> as a vertical-lift bridge.</p>
    <h4>How it lifts</h4>
    <ul>
      <li>The roadway span is <b>386 feet</b> long and weighs about <b>1,000 tons</b>.</li>
      <li>Huge concrete counterweights inside the towers balance it, so modest motors can raise it.</li>
      <li>It rises up to <b>135 feet</b> in a few minutes and lifts <b>thousands of times a year</b>, for giant freighters and for sailboats alike.</li>
    </ul>
    <h4>Listen for it</h4>
    <p>The bridge answers ships' horn salutes with its own horns, a pair of locomotive air horns. Try both in <i>Horn signals</i>.</p>`,

  ships: `
    <div class="types">
      <div><b>🚢 Lakers</b>Built for the Great Lakes and never leave them. Long and slab-sided, most with the pilothouse at the stern.
        Most are <i>self-unloaders</i> with a long boom that swings out to unload the cargo with no help from shore.</div>
      <div><b>📏 1,000-footers</b>The giants among the lakers. Only thirteen were ever built. They're too big for the Welland Canal,
        so they stay on the upper lakes. The <i>Paul R. Tregurtha</i> is the longest at 1,013½ ft.</div>
      <div><b>🌊 Salties</b>Ocean ships that come up the St. Lawrence Seaway. At most about 740 ft long, to fit the Seaway locks.
        Look for deck cranes and foreign flags. They often load grain, or bring in wind turbine blades and steel.</div>
      <div><b>⚓ Tug-barges</b>A tug fits into a notch at the back of a big barge and pushes it, like the 1,000-ft <i>Presque Isle</i>.</div>
      <div><b>🛟 Tugs</b>Harbor tugs nudge big ships around tight turns and into docks, especially in wind or ice.</div>
      <div><b>🇺🇸 Coast Guard</b>The cutter <i>Alder</i>, based in Duluth, tends navigation buoys and breaks ice in winter.</div>
      <div><b>🛳️ Cruise &amp; tour boats</b>Expedition cruise ships visit in summer, and harbor tour boats run from Canal Park.</div>
    </div>
    <h4>What are they carrying?</h4>
    <p><b>Taconite</b> (iron ore pellets from the Iron Range) is the port's signature cargo. There's also <b>coal</b>, <b>grain</b>, <b>limestone</b>, cement and salt.
      A ship riding high with lots of red hull showing is usually empty and coming to load. One sitting deep is loaded.</p>`,

  horns: `
    <p>Ships and the bridge "talk" with long (about 3 seconds) and short (about 1 second) blasts. Tap ▶ to hear each one.</p>
    <table class="signal-table">
      <tr><td>— · — ·</td><td><b>Please lift the bridge.</b> The ship asks. The bridge repeats it to say "heard you".</td>
        <td><button class="btn small" data-horn="request">▶ Ship</button> <button class="btn small" data-horn="request-bridge">▶ Bridge</button></td></tr>
      <tr><td>— · ·</td><td><b>Captain's salute.</b> A friendly hello to Duluth, answered the same way by the bridge. The one you'll hear most.</td>
        <td><button class="btn small" data-horn="salute">▶ Ship</button> <button class="btn small" data-horn="bridge">▶ Bridge</button></td></tr>
      <tr><td>— — — · ·</td><td><b>Master salute.</b> A ship's first trip of the season through the canal, or a special occasion.</td>
        <td><button class="btn small" data-horn="master">▶</button></td></tr>
      <tr><td>—</td><td><b>One long blast.</b> Leaving the dock, or coming up to a blind bend.</td>
        <td><button class="btn small" data-horn="long">▶</button></td></tr>
      <tr><td>·</td><td><b>One short.</b> "I'll pass you on my port (left) side."</td><td><button class="btn small" data-horn="one-short">▶</button></td></tr>
      <tr><td>· ·</td><td><b>Two short.</b> "I'll pass you on my starboard (right) side."</td><td><button class="btn small" data-horn="two-short">▶</button></td></tr>
      <tr><td>· · · · ·</td><td><b>Five or more short.</b> Danger or doubt: "I don't understand what you're doing!"</td>
        <td><button class="btn small" data-horn="danger">▶</button></td></tr>
    </table>`,

  current: `
    <p>The three lights on the bridge's north tower (red, amber and green, on both the lake side and the harbor side) warn boaters about the current in the canal.
      Army Corps of Engineers sensors on the piers measure it.</p>
    <ul>
      <li><b class="t-red">Red</b>: inbound, from the lake into the harbor (¾ to 1½ knots).</li>
      <li><b class="t-amber">Amber</b>: neutral.</li>
      <li><b class="t-green">Green</b>: outbound, from the harbor out to the lake (¾ to 1½ knots).</li>
      <li><b>Flashing</b>: faster than 1½ knots. Kayaks, paddleboards and small boats should take extra care.</li>
    </ul>
    <h4>Why does the water flow both ways?</h4>
    <p>Lake Superior has a <b>seiche</b>: wind and air pressure tip the lake, and it rocks back and forth like water in a bathtub.
      The harbor fills and drains through the canal every few hours, so the current reverses even though there are no real tides.
      The St. Louis River adds a steady push outward.</p>`,

  tips: `
    <ul>
      <li><b>Watch the "Next ship" card.</b> The bridge usually starts up a few minutes before a big ship reaches it.</li>
      <li><b>Turn on the marine radio.</b> Ships call the bridge as they approach, so you'll often hear them before you see them.</li>
      <li><b>Best spots:</b> the canal pier walkways and North Pier Lighthouse, the Maritime Visitor Center, the Lakewalk, and Park Point just across the bridge.
        For ships using the Superior Entry, try Wisconsin Point.</li>
      <li><b>Wave!</b> Crews often wave back, and captains love to answer with a salute.</li>
      <li><b>Dress warm.</b> It's usually cooler by the lake, even in July.</li>
      <li><b>Season:</b> shipping runs from late March until mid-January, when the Soo Locks close. Winter brings ice and lakers laid up in the harbor.</li>
    </ul>`,
};

export const FACTS = [
  "The Aerial Lift Bridge opened in 1905 as a transporter bridge: a gondola carried people across the canal. It was rebuilt as a lift bridge in 1929–30.",
  "The bridge's 386-foot, roughly 1,000-ton roadway span can rise about 135 feet to let ships pass underneath.",
  "Ships and the bridge trade horn signals: a captain's long–short–short salute is answered by the bridge.",
  "The Duluth–Superior harbor is the farthest-inland freshwater seaport in North America, roughly 2,300 miles from the Atlantic by the St. Lawrence Seaway.",
  "The biggest Great Lakes freighters are 1,000 feet long, more than three football fields. They're too big to leave the Great Lakes.",
  "Ocean-going ships that visit the Great Lakes are nicknamed \"salties\". Ships that stay on the lakes are \"lakers\".",
  "The Duluth Ship Canal was dug through Minnesota Point in 1871, giving Duluth its own entry to the harbor.",
  "Lake Superior holds about 10% of the world's fresh surface water.",
  "The canal current sloshes back and forth because of a seiche: the whole lake rocks like water in a bathtub.",
  "Iron ore pellets (taconite) from Minnesota's Iron Range are the port's biggest cargo, along with coal, grain and limestone.",
  "Canal Park's lighthouses guard the entry: the South Breakwater Outer Light (1901) and the North Pier Light (1910).",
  "The shipping season runs from late March to mid-January, when the Soo Locks close for winter maintenance.",
  "Many lakers are self-unloaders: a long conveyor boom swings out so they can unload with no help from shore.",
  "The Arthur M. Anderson, a regular Duluth visitor, was the last ship in radio contact with the Edmund Fitzgerald in 1975.",
];
