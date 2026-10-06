// Apple's Guideline 2.1 "Information Needed" questionnaire, which every
// developer account with no review history gets on its first submission.
// Nothing is wrong with the app; they want to know what it is.
//
//   node store/review-answers.js         print the answers
//   node store/review-answers.js --save  also write them to the App Review
//                                        Notes field, which Apple asks for
//                                        explicitly so future submissions
//                                        carry the same context
//
// Item 1 of their list is a screen recording on a physical device. That cannot
// be produced here; it is captured on the phone and attached to the reply.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
for (const l of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

export const ANSWERS = `This app is private to one property management company. It is not a marketplace and has no public sign-up. Please use the demo account below, which reads fictional data.

SIGN IN
On the sign-in screen tap "Sign in with a password instead", then use the email and password in the App Review Information fields above. The default button emails a one-time link, which is how real residents sign in; the review account's address has no mailbox, so the password button is the way in.

The review account is flagged in our database to read fictional records instead of the company's live ones, so nothing you see belongs to a real person.

2. PURPOSE AND TARGET AUDIENCE
Stephen Fleming Realty is used by the residents, property owners, contractors and office staff of Stephen Fleming Realty (legal entity D'Angelo Realty Group, Inc.), a property management company in Mechanicsburg, Pennsylvania that manages about 678 rental units. Accounts are matched by email address against the company's own tenant, owner, vendor and staff records; an address the company does not recognise gets an empty "pending assignment" account.

The problem it solves: maintenance requests arrive today as phone calls to a four-person office, get written on paper, re-keyed into the company's management system, and the resident never hears what happened. In the app a resident reports a problem with a photo in a few taps, watches it move from reported to scheduled to done, and can see their lease and balance. The office sees every open job across every property and assigns a contractor. The contractor arrives knowing the address, the unit, the entry notes and what the problem looks like.

3. SETTING UP AND ACCESSING THE MAIN FEATURES
Sign in as above, then:
- Home shows the lease end date, monthly rent, status, balance, and open maintenance requests.
- "Report an issue" opens the request form. "Add a photo of the problem" opens the device camera or the photo library. Submitting creates the request.
- Tapping a request opens its detail, with photos and status.
- Profile > Notifications > Turn on shows the push permission prompt.
- Profile > Delete my account performs in-app account deletion.
No sample files are needed.

4. EXTERNAL SERVICES
- Buildium (buildium.com), property management platform. Source of properties, units, leases, tenants, owners, vendors and work orders. The account belongs to D'Angelo Realty Group, Inc., who authorised the integration.
- Supabase (supabase.com), authentication, application database, and private storage for photos.
- Resend (resend.com), transactional email for sign-in links and inspection reports.
- Google Maps Platform, address geocoding and the staff map.
- Apple Push Notification service, for notifications.
- Vercel, hosting.
There is no analytics SDK, no advertising SDK, no AI service, and no payment processing. The app never takes payments.

5. REGIONAL DIFFERENCES
None. The app behaves identically everywhere and is offered in the United States only, where every property and every user is located.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL
Property management is not a regulated industry in the sense of health, finance or gambling, and the app provides no regulated service. It shows one company's own records to that company's own residents, owners and contractors.

The only third-party material is that company's Buildium data, read through Buildium's official API with credentials issued to D'Angelo Realty Group, Inc., our client and the owner of the account. Written confirmation from the client is available on request.

On user-generated content: residents and contractors attach photographs to their own maintenance requests. A photo is visible only to the office and to the contractor assigned to that job. There is no feed, no distribution between users, and no way for one user to see another user's content, so content reporting and blocking mechanisms do not apply.`;

if (process.argv.includes("--save")) {
  const need = (k) => { const v = process.env[k]; if (!v) { console.error("Missing " + k); process.exit(2); } return v; };
  const key = fs.readFileSync(need("ASC_KEY_PATH"), "utf8");
  const b64u = (s) => Buffer.from(s).toString("base64url");
  const token = () => {
    const now = Math.floor(Date.now() / 1000);
    const head = b64u(JSON.stringify({ alg: "ES256", kid: need("ASC_KEY_ID"), typ: "JWT" }));
    const body = b64u(JSON.stringify({ iss: need("ASC_ISSUER_ID"), iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
    const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
    return `${head}.${body}.${Buffer.from(sig).toString("base64url")}`;
  };
  const api = async (method, url, body) => {
    const r = await fetch("https://api.appstoreconnect.apple.com/v1" + url, {
      method, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const t = await r.text();
    const j = t ? JSON.parse(t) : {};
    if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${j.errors?.[0]?.detail || t.slice(0, 200)}`);
    return j;
  };
  const app = (await api("GET", "/apps?filter[bundleId]=com.dangelore.flemingrealty")).data[0];
  const v = (await api("GET", `/apps/${app.id}/appStoreVersions?filter[platform]=IOS&filter[versionString]=1.0`)).data[0];
  const rd = (await api("GET", `/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
  await api("PATCH", `/appStoreReviewDetails/${rd.id}`, {
    data: { type: "appStoreReviewDetails", id: rd.id, attributes: { notes: ANSWERS } },
  });
  const after = (await api("GET", `/appStoreVersions/${v.id}/appStoreReviewDetail`)).data;
  console.log(`notes saved: ${after.attributes.notes.length} characters`);
} else {
  console.log(ANSWERS);
  console.log(`\n[${ANSWERS.length} characters]`);
}
