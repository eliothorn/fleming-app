// App Store preview plates for Stephen Fleming Realty.
//
// Design thesis: an engineer's drawing sheet, issued as five plates. Steve is a
// P.E.; the logo is a goat planted on rock, not a luxury mark; the palette is
// engineering-ink navy and surveyor's brass. So each panel is a numbered plate
// with a full-bleed rule, small-caps mono annotations, and the phone cropped
// like a detail view running off the bottom edge.
//
// Typography is deliberately NOT the app's own Playfair + Montserrat (the most
// common "trying to look elegant" pairing). Newsreader is a lower-contrast
// editorial serif that holds up on a dark ground where Playfair's hairlines
// break up, and IBM Plex Mono carries the drawing-sheet labels.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SHOTS = "C:/Users/eliot/claudecode/fleming-app/store/screenshots";
const MARK = path.join(__dirname, "previews-mark.png");
const OUT = "C:/Users/eliot/claudecode/fleming-app/store/previews";

// Colours sampled from store/brand-logo-master.jpg, not chosen from a palette.
const NAVY = "#0D1C33";   // the logo's field
const GOLD = "#C3974E";   // the rock the goat stands on
const SAND = "#F2F0EB";   // the app's paper
const MUTED = "#A2A6AB";

const PLATES = [
  {
    file: "1-resident-home.png", idx: "01", role: "Resident",
    head: "Your lease,<br>your rent,<br>your repairs.",
    lead: 1.02, size: 104,
  },
  {
    file: "2-resident-report.png", idx: "02", role: "Resident",
    head: "Report a leak<br>at 11&nbsp;p.m.",
    sub: "Add a photo so they see what you see.",
    lead: 1.0, size: 132,
  },
  {
    file: "3-office-pulse.png", idx: "03", role: "Office",
    head: "Every open job,<br>every property.",
    lead: 1.04, size: 104,
  },
  {
    file: "4-office-orders.png", idx: "04", role: "Office",
    head: "Assign a contractor<br>without a phone call.",
    lead: 1.04, size: 92,
  },
  {
    file: "5-contractor-jobs.png", idx: "05", role: "Contractor",
    head: "Contractors arrive<br>knowing the job.",
    sub: "Address, unit, entry notes, and a photo.",
    lead: 1.04, size: 98,
    // The contractor's screen is genuinely short: two jobs and a counter row.
    // Cropped to its content and shown whole, it closes the set deliberately
    // instead of leaving half a phone of empty paper.
    deviceH: 1357, whole: true, subBelow: true, mark: true,
  },
];

const dataUri = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");

function html(plate, shotPath, W, H) {
  const k = W / 1290; // every measurement below is authored against the 6.7" canvas
  const px = (n) => (n * k).toFixed(2) + "px";
  const subEl = plate.sub ? `<p class="sub">${plate.sub}</p>` : "";
  const subAbove = plate.sub && !plate.subBelow ? subEl : "";
  // A drawing set ends with the seal. The mark closes the strip, on the
  // one plate whose screen is short enough to leave room for it.
  const markEl = plate.mark ? `<img class="mark" src="${dataUri(MARK)}" alt="">` : "";
  const subBelow = plate.sub && plate.subBelow ? subEl : "";

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{
    background:${NAVY};
    color:${SAND};
    position:relative;
    -webkit-font-smoothing:antialiased;
  }
  /* A faint lift behind the device so it separates from the ground without a
     glow. Radial, off-centre, following the device. */
  .lift{
    position:absolute;inset:0;
    background:radial-gradient(120% 62% at 50% 74%, #16294380 0%, #0D1C3300 62%);
  }
  /* Drawing-sheet hairlines. 64px pitch, barely there. */
  .grid{
    position:absolute;inset:0;
    background-image:
      repeating-linear-gradient(to right, #F2F0EB0A 0 1px, transparent 1px ${px(64)}),
      repeating-linear-gradient(to bottom, #F2F0EB08 0 1px, transparent 1px ${px(64)});
  }
  /* Real grain. Flat digital surfaces are the giveaway. */
  .grain{
    position:absolute;inset:0;opacity:.055;mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/></filter><rect width='220' height='220' filter='url(%23n)'/></svg>");
  }
  .plate{position:absolute;inset:0;display:flex;flex-direction:column}

  /* The recurring motif: a numbered plate index on a full-bleed rule. */
  header{
    display:flex;align-items:center;gap:${px(26)};
    margin:${px(104)} ${px(84)} 0;
    font-family:"IBM Plex Mono",monospace;
    font-size:${px(27)};letter-spacing:.2em;text-transform:uppercase;
  }
  .idx{color:${GOLD};font-weight:500}
  .rule{flex:1;height:1px;background:#F2F0EB2E}
  .role{color:${MUTED}}

  h1{
    margin:${px(66)} ${px(84)} 0;
    font-family:Newsreader,Georgia,serif;
    font-variation-settings:"opsz" 72;
    font-weight:500;
    font-size:${px(plate.size)};
    line-height:${plate.lead};
    letter-spacing:-.021em;
    text-wrap:balance;
  }
  .sub{
    margin:${px(30)} ${px(84)} 0;
    font-family:Newsreader,Georgia,serif;
    font-style:italic;font-weight:400;
    font-variation-settings:"opsz" 20;
    font-size:${px(43)};line-height:1.35;letter-spacing:.004em;
    color:${MUTED};max-width:${px(860)};
  }

  /* The phone is cropped like a detail view: it runs off the bottom edge, so
     no dead space below the content and no floating tab bar in a void. */
  .device{
    position:absolute;left:50%;top:${px(800)};
    transform:translateX(-50%);
    width:${px(1120)};height:${px(plate.deviceH || 2000)};
    border-radius:${px(66)} ${px(66)} ${px(plate.whole ? 66 : 0)} ${px(plate.whole ? 66 : 0)};
    overflow:hidden;
    box-shadow:0 ${px(34)} ${px(90)} #04091480, 0 ${px(3)} 0 #F2F0EB1F inset,
               ${px(1)} 0 0 #F2F0EB14 inset, -${px(1)} 0 0 #F2F0EB14 inset;
  }
  .device img{width:100%;display:block}

  /* Drawing callout: a hairline leader out of the right margin. */
  /* On the closing plate the deck sits under the device, in the room the
     short screen leaves behind. */
  .mark{
    position:absolute;left:50%;transform:translateX(-50%);
    bottom:${px(150)};width:${px(150)};opacity:.9;
  }
  .device + .sub{
    position:absolute;left:${px(84)};right:${px(84)};
    top:${px(800 + (plate.deviceH || 2000) + 72)};
    margin:0;max-width:none;
  }
</style></head><body>
  <div class="lift"></div><div class="grid"></div>
  <div class="plate">
    <header><span class="idx">${plate.idx}</span><span class="rule"></span><span class="role">${plate.role}</span></header>
    <h1>${plate.head}</h1>
    ${subAbove}
    <figure class="device"><img src="${dataUri(shotPath)}" alt=""></figure>
    ${subBelow}
    ${markEl}
  </div>
  <div class="grain"></div>
</body></html>`;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--force-device-scale-factor=1"] });
  // Each canvas matches its source capture exactly, so nothing is resampled.
  const CANVASES = [["iphone-6.7", 1290, 2796], ["iphone-6.5", 1242, 2688]];
  for (const [dir, W, H] of CANVASES) {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    for (const plate of PLATES) {
      const page = await browser.newPage();
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      await page.setContent(html(plate, path.join(SHOTS, dir, plate.file), W, H), { waitUntil: "networkidle0" });
      await page.evaluate(() => document.fonts.ready);
      const out = path.join(OUT, dir, plate.file);
      await page.screenshot({ path: out, type: "png" });
      await page.close();
      console.log("  " + dir + "/" + plate.file);
    }
  }
  await browser.close();
  console.log("done");
})();
