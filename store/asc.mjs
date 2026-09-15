#!/usr/bin/env node
// App Store Connect, filled from the repo instead of by hand.
//
//   node store/asc.mjs status        what exists on Apple's side for this app
//   node store/asc.mjs metadata      name, subtitle, categories, description, keywords, URLs
//   node store/asc.mjs screenshots   upload store/screenshots/* to the 6.7" and 6.5" slots
//   node store/asc.mjs review        reviewer contact, demo account, notes, age rating
//   node store/asc.mjs build         attach the newest processed TestFlight build to 1.0
//   node store/asc.mjs submit        send 1.0 for review (asks for a typed confirmation)
//   node store/asc.mjs all           everything except submit
//
// Needs, in the environment or in .env.local:
//   ASC_KEY_ID        the App Store Connect API key id (10 characters)
//   ASC_ISSUER_ID     the issuer id shown on the same page (a UUID)
//   ASC_KEY_PATH      path to the downloaded AuthKey_XXXXXXXXXX.p8
//   ASC_REVIEW_EMAIL  who Apple's reviewer may email (defaults to elihorn@udel.edu)
//   ASC_REVIEW_PHONE  who they may phone, with country code, e.g. +17175551234
//   ASC_DEMO_EMAIL / ASC_DEMO_PASSWORD   the review account (see LISTING.md section 6)
//
// The app record itself cannot be created by the API; that is the one thing
// that has to be clicked in App Store Connect first. App Privacy (the data-
// collection questionnaire) is also UI-only; LISTING.md section 3 has the
// answers.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
for (const l of fs.existsSync(path.join(ROOT, ".env.local")) ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/) : []) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const BUNDLE_ID = "com.dangelore.flemingrealty";
const VERSION = "1.0";
const LOCALE = "en-US";

// ── Listing copy (mirrors store/LISTING.md; edit there, then here) ────────────
const COPY = {
  name: "Stephen Fleming Realty",
  subtitle: "Rentals, requests and repairs",
  privacyPolicyUrl: "https://www.flemingrealty.org/privacy",
  supportUrl: "https://www.flemingrealty.org/support",
  marketingUrl: "https://www.flemingrealty.org",
  primaryCategory: "BUSINESS",
  secondaryCategory: "PRODUCTIVITY",
  promotionalText: "Report a problem, add a photo, and watch it get fixed. For residents, owners and contractors of Stephen Fleming Realty.",
  keywords: "rental,tenant,landlord,maintenance,repair,work order,property management,lease,apartment,mechanicsburg",
  whatsNew: "First release.",
  description: `The Stephen Fleming Realty app puts your rental in your pocket.

RESIDENTS
Report a maintenance problem in a few taps and attach a photo so the office sees exactly what you see. Follow it from reported to scheduled to done. See your lease, your unit and who to call.

OWNERS
See the properties you own, what's open on each of them, and your account balance held by the office.

CONTRACTORS
Jobs assigned to you, with the address, the unit, entry notes and a photo of the problem, so you turn up knowing what you're walking into.

OFFICE STAFF
The whole portfolio at a glance: urgent, open and completed work across every property, contractor assignment, inspections with photo reports, and a map of where today's work is.

Everything in the app is the same system the office runs on, so a request made here is the same request the office sees, with nothing to re-key and nothing lost between a phone call and a ticket.

Sign-in is by email. There is no password to remember. Use the email address the office has on file for you.

This app is for tenants, owners, contractors and staff of Stephen Fleming Realty (D'Angelo Realty Group, Inc.), Mechanicsburg, PA.`,
  reviewNotes: `This app is for tenants, owners, contractors and staff of a property management company in Pennsylvania. Real accounts are matched to the company's records by email address, which is why a review account is provided rather than open sign-up.

Sign in: enter the email below and tap "Email me a sign-in link", then type the 8-digit code from that email into the app, or use the password path under "Sign in with a password instead".

To exercise the native features:
1. Home > Report an issue > Add a photo of the problem. This opens the device camera or the photo library. The request is created in the company's live system with the photo attached.
2. Profile > Notifications > Turn on, and allow notifications when prompted.
3. Profile > Delete my account demonstrates in-app account deletion.

The app loads its interface from our server so that residents, owners and staff always see the same live data as the office. The camera and photo library, push notifications and the home-screen presence are native.`,
};

// ── Auth ─────────────────────────────────────────────────────────────────────
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}. See the header of this file.`); process.exit(2); } return v; };
const KEY_ID = need("ASC_KEY_ID"), ISSUER = need("ASC_ISSUER_ID"), KEY_PATH = need("ASC_KEY_PATH");
const privateKey = fs.readFileSync(KEY_PATH, "utf8");
const b64u = (s) => Buffer.from(s).toString("base64url");
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" }));
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${Buffer.from(sig).toString("base64url")}`;
}
const API = "https://api.appstoreconnect.apple.com/v1";
async function asc(method, url, body) {
  const r = await fetch(url.startsWith("http") ? url : API + url, {
    method, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) {
    const e = json.errors?.[0];
    throw new Error(`${method} ${url} -> ${r.status} ${e?.code || ""} ${e?.title || ""}: ${e?.detail || text.slice(0, 300)}`);
  }
  return json;
}
const rel = (type, id) => ({ data: { type, id } });

// ── Lookups ──────────────────────────────────────────────────────────────────
async function app() {
  const r = await asc("GET", `/apps?filter[bundleId]=${BUNDLE_ID}`);
  const a = r.data?.[0];
  if (!a) throw new Error(`No app record for ${BUNDLE_ID}. Create it in App Store Connect first (My Apps > + > New App).`);
  return a;
}
async function version(appId) {
  const r = await asc("GET", `/apps/${appId}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${VERSION}`);
  if (r.data?.[0]) return r.data[0];
  console.log(`  creating App Store version ${VERSION}`);
  return (await asc("POST", "/appStoreVersions", { data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString: VERSION }, relationships: { app: rel("apps", appId) } } })).data;
}
async function versionLocalization(versionId) {
  const r = await asc("GET", `/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const l = r.data?.find((x) => x.attributes.locale === LOCALE);
  if (l) return l;
  return (await asc("POST", "/appStoreVersionLocalizations", { data: { type: "appStoreVersionLocalizations", attributes: { locale: LOCALE }, relationships: { appStoreVersion: rel("appStoreVersions", versionId) } } })).data;
}
async function appInfo(appId) {
  const r = await asc("GET", `/apps/${appId}/appInfos`);
  // The editable one is whichever is not yet live.
  return r.data.find((i) => i.attributes.appStoreState !== "READY_FOR_SALE") || r.data[0];
}

// ── Commands ─────────────────────────────────────────────────────────────────
async function status() {
  const a = await app();
  console.log(`app: ${a.attributes.name} (${a.id}) sku=${a.attributes.sku}`);
  const vs = await asc("GET", `/apps/${a.id}/appStoreVersions?filter[platform]=IOS`);
  for (const v of vs.data) console.log(`  version ${v.attributes.versionString}: ${v.attributes.appStoreState}`);
  const builds = await asc("GET", `/builds?filter[app]=${a.id}&sort=-uploadedDate&limit=5`);
  for (const b of builds.data) console.log(`  build ${b.attributes.version}: ${b.attributes.processingState} (${b.attributes.uploadedDate})`);
  if (!builds.data.length) console.log("  no builds uploaded yet");
}

async function metadata() {
  const a = await app();
  const info = await appInfo(a.id);
  // Name, subtitle, privacy URL live on the app info localization.
  const ils = await asc("GET", `/appInfos/${info.id}/appInfoLocalizations`);
  let il = ils.data.find((x) => x.attributes.locale === LOCALE);
  const ilAttrs = { name: COPY.name, subtitle: COPY.subtitle, privacyPolicyUrl: COPY.privacyPolicyUrl };
  if (il) await asc("PATCH", `/appInfoLocalizations/${il.id}`, { data: { type: "appInfoLocalizations", id: il.id, attributes: ilAttrs } });
  else await asc("POST", "/appInfoLocalizations", { data: { type: "appInfoLocalizations", attributes: { locale: LOCALE, ...ilAttrs }, relationships: { appInfo: rel("appInfos", info.id) } } });
  console.log("  name / subtitle / privacy URL set");
  // Categories.
  await asc("PATCH", `/appInfos/${info.id}`, { data: { type: "appInfos", id: info.id, relationships: {
    primaryCategory: rel("appCategories", COPY.primaryCategory), secondaryCategory: rel("appCategories", COPY.secondaryCategory) } } });
  console.log(`  categories: ${COPY.primaryCategory} / ${COPY.secondaryCategory}`);
  // Version copy.
  const v = await version(a.id);
  const l = await versionLocalization(v.id);
  await asc("PATCH", `/appStoreVersionLocalizations/${l.id}`, { data: { type: "appStoreVersionLocalizations", id: l.id, attributes: {
    description: COPY.description, keywords: COPY.keywords, promotionalText: COPY.promotionalText,
    supportUrl: COPY.supportUrl, marketingUrl: COPY.marketingUrl, whatsNew: COPY.whatsNew } } });
  console.log("  description / keywords / promotional text / URLs / what's new set");
  await asc("PATCH", `/appStoreVersions/${v.id}`, { data: { type: "appStoreVersions", id: v.id, attributes: { copyright: `© ${new Date().getFullYear()} D'Angelo Realty Group, Inc.` } } });
  console.log("  copyright set");
}

async function screenshots() {
  const a = await app();
  const v = await version(a.id);
  const l = await versionLocalization(v.id);
  const sets = { "iphone-6.7": "APP_IPHONE_67", "iphone-6.5": "APP_IPHONE_65" };
  for (const [dir, displayType] of Object.entries(sets)) {
    const folder = path.join(ROOT, "store", "screenshots", dir);
    const files = fs.readdirSync(folder).filter((f) => f.endsWith(".png")).sort();
    const existing = await asc("GET", `/appStoreVersionLocalizations/${l.id}/appScreenshotSets`);
    let set = existing.data.find((s) => s.attributes.screenshotDisplayType === displayType);
    if (!set) set = (await asc("POST", "/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: displayType }, relationships: { appStoreVersionLocalization: rel("appStoreVersionLocalizations", l.id) } } })).data;
    const already = (await asc("GET", `/appScreenshotSets/${set.id}/appScreenshots`)).data.map((s) => s.attributes.fileName);
    for (const f of files) {
      if (already.includes(f)) { console.log(`  ${displayType} ${f}: already there`); continue; }
      const bytes = fs.readFileSync(path.join(folder, f));
      const reserve = (await asc("POST", "/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName: f, fileSize: bytes.length }, relationships: { appScreenshotSet: rel("appScreenshotSets", set.id) } } })).data;
      for (const op of reserve.attributes.uploadOperations) {
        const chunk = bytes.subarray(op.offset, op.offset + op.length);
        const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
        const r = await fetch(op.url, { method: op.method, headers, body: chunk });
        if (!r.ok) throw new Error(`upload chunk for ${f} -> ${r.status}`);
      }
      const md5 = crypto.createHash("md5").update(bytes).digest("hex");
      await asc("PATCH", `/appScreenshots/${reserve.id}`, { data: { type: "appScreenshots", id: reserve.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
      console.log(`  ${displayType} ${f}: uploaded`);
    }
  }
}

async function review() {
  const a = await app();
  const v = await version(a.id);
  const attrs = {
    contactFirstName: "Eliot", contactLastName: "Horn",
    contactEmail: process.env.ASC_REVIEW_EMAIL || "elihorn@udel.edu",
    contactPhone: need("ASC_REVIEW_PHONE"),
    demoAccountName: need("ASC_DEMO_EMAIL"), demoAccountPassword: need("ASC_DEMO_PASSWORD"), demoAccountRequired: true,
    notes: COPY.reviewNotes,
  };
  const existing = await asc("GET", `/appStoreVersions/${v.id}/appStoreReviewDetail`).catch(() => ({}));
  if (existing.data) await asc("PATCH", `/appStoreReviewDetails/${existing.data.id}`, { data: { type: "appStoreReviewDetails", id: existing.data.id, attributes: attrs } });
  else await asc("POST", "/appStoreReviewDetails", { data: { type: "appStoreReviewDetails", attributes: attrs, relationships: { appStoreVersion: rel("appStoreVersions", v.id) } } });
  console.log("  review contact, demo account and notes set");
  // Age rating: nothing objectionable, every answer "none".
  const ar = await asc("GET", `/appStoreVersions/${v.id}/ageRatingDeclaration`);
  const none = ["alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "horrorOrFearThemes", "matureOrSuggestiveThemes", "medicalOrTreatmentInformation", "profanityOrCrudeHumor", "sexualContentGraphicAndNudity", "sexualContentOrNudity", "violenceCartoonOrFantasy", "violenceRealistic", "violenceRealisticProlongedGraphicOrSadistic"];
  const decl = Object.fromEntries(none.map((k) => [k, "NONE"]));
  Object.assign(decl, { gambling: false, unrestrictedWebAccess: false, kidsAgeBand: null });
  await asc("PATCH", `/ageRatingDeclarations/${ar.data.id}`, { data: { type: "ageRatingDeclarations", id: ar.data.id, attributes: decl } });
  console.log("  age rating declared (4+)");
}

async function build() {
  const a = await app();
  const v = await version(a.id);
  const builds = await asc("GET", `/builds?filter[app]=${a.id}&filter[processingState]=VALID&sort=-uploadedDate&limit=1`);
  const b = builds.data?.[0];
  if (!b) throw new Error("No processed build yet. Run the Codemagic ios-testflight workflow and wait for Apple to finish processing.");
  await asc("PATCH", `/appStoreVersions/${v.id}/relationships/build`, { data: { type: "builds", id: b.id } });
  console.log(`  build ${b.attributes.version} attached to ${VERSION}`);
}

async function submit() {
  const a = await app();
  const v = await version(a.id);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(`Submit ${COPY.name} ${VERSION} to App Review? Type SUBMIT to continue: `, res));
  rl.close();
  if (answer.trim() !== "SUBMIT") { console.log("  not submitted"); return; }
  const rs = (await asc("POST", "/reviewSubmissions", { data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: rel("apps", a.id) } } })).data;
  await asc("POST", "/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: rel("reviewSubmissions", rs.id), appStoreVersion: rel("appStoreVersions", v.id) } } });
  await asc("PATCH", `/reviewSubmissions/${rs.id}`, { data: { type: "reviewSubmissions", id: rs.id, attributes: { submitted: true } } });
  console.log("  submitted for review");
}

const cmd = process.argv[2];
const run = { status, metadata, screenshots, review, build, submit, all: async () => { await metadata(); await screenshots(); await review(); await build().catch((e) => console.log("  (build not attached: " + e.message + ")")); } }[cmd];
if (!run) { console.error("usage: node store/asc.mjs status|metadata|screenshots|review|build|submit|all"); process.exit(2); }
run().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
