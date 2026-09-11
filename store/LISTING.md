# Store listing — Stephen Fleming Realty

Everything App Store Connect and Google Play Console ask for, in the order they ask
for it, so it can be pasted rather than composed under pressure. Character limits
are Apple's and Google's, and every field below is inside them.

Facts this is built on: bundle id `com.dangelore.flemingrealty`, Apple team
**D'ANGELO REALTY GROUP INC**, app served from https://www.flemingrealty.org,
office line 717-774-7791, contact inspections@dangelore.com.

---

## 1. App Store Connect — App Information

| Field | Value |
|---|---|
| Name (30) | `Stephen Fleming Realty` |
| Subtitle (30) | `Rentals, requests and repairs` |
| Primary category | Business |
| Secondary category | Productivity |
| Content rights | Does not contain, show, or access third-party content |
| Age rating | 4+ (no objectionable content; answer "No" to every questionnaire item) |
| Privacy Policy URL | `https://www.flemingrealty.org/privacy` |
| Support URL | `https://www.flemingrealty.org/support` |
| Marketing URL | `https://www.flemingrealty.org` (optional) |
| Copyright | `© 2026 D'Angelo Realty Group, Inc.` |

Seller name will show as **D'Angelo Realty Group Inc** under the app name.
That is the enrolled legal entity and cannot be changed to the trade name.
Worth telling Steve before he sees it.

## 2. App Store Connect — Version Information

**Promotional text** (170, editable without a new build):

> Report a problem, add a photo, and watch it get fixed. For residents, owners and
> contractors of Stephen Fleming Realty.

**Description** (4000):

> The Stephen Fleming Realty app puts your rental in your pocket.
>
> RESIDENTS
> Report a maintenance problem in a few taps and attach a photo so the office
> sees exactly what you see. Follow it from reported to scheduled to done, with a
> notification at each step. See your lease, your unit and who to call.
>
> OWNERS
> See the properties you own, what's open on each of them, and your account
> balance held by the office.
>
> CONTRACTORS
> Jobs assigned to you, with the address, the unit, entry notes and a photo of
> the problem, so you turn up knowing what you're walking into.
>
> OFFICE STAFF
> The whole portfolio at a glance: urgent, open and completed work across every
> property, contractor assignment, inspections with photo reports, and a map of
> where today's work is.
>
> Everything in the app is the same system the office runs on, so a request made
> here is the same request the office sees, with nothing to re-key and nothing
> lost between a phone call and a ticket.
>
> Sign-in is by email link. There is no password to remember. Use the email
> address the office has on file for you.
>
> This app is for tenants, owners, contractors and staff of Stephen Fleming
> Realty (D'Angelo Realty Group, Inc.), Mechanicsburg, PA.

**Keywords** (100, comma-separated, no spaces after commas):

```
rental,tenant,landlord,maintenance,repair,work order,property management,lease,apartment,mechanicsburg
```

**What's New** (first release):

> First release.

## 3. App Store Connect — App Privacy (the "nutrition label")

Answer **Yes, we collect data from this app**, then declare exactly these and
nothing else. There is no analytics or advertising SDK in the app, so do not
tick anything under Usage Data, Diagnostics or Identifiers.

| Data type | Category | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Email Address | Contact Info | Yes | No | App Functionality |
| Name | Contact Info | Yes | No | App Functionality |
| Phone Number | Contact Info | Yes | No | App Functionality |
| Physical Address | Contact Info | Yes | No | App Functionality |
| Photos or Videos | User Content | Yes | No | App Functionality |
| Other Financial Info (owner balances, rent) | Financial Info | Yes | No | App Functionality |

Push notification device tokens do not need declaring; Apple exempts them when
they are used only to deliver notifications.

The privacy page at /privacy already describes all of the above in plain
language, which is what Apple checks the label against.

## 4. App Store Connect — App Review Information

**Contact:** Eliot Horn, elihorn@udel.edu, and a phone number Apple can reach
during US business hours.

**Sign-in required:** Yes. This is the part that needs a decision, see §6.

**Notes for the reviewer** (paste as-is once the review account exists):

> This app is for tenants, owners, contractors and staff of a property
> management company in Pennsylvania. Real accounts are matched to the
> company's records by email address, which is why a review account is provided
> below rather than open sign-up.
>
> Sign in with the email and password below (the "Sign in with a password
> instead" link under the email field).
>
> To exercise the native features:
> 1. Home > Report an issue > add a photo. This opens the device camera and
>    photo library.
> 2. Allow notifications when prompted; a status change on the request sends a
>    push notification to the device.
> 3. Profile > Delete my account demonstrates in-app account deletion.
>
> The app loads its interface from our server so that residents, owners and
> staff always see the same live data as the office. The camera, photo
> library, push notifications and the home-screen presence are native.

## 5. Screenshots

Apple requires one set per size class. Minimum to pass review:

| Device | Pixels | Count |
|---|---|---|
| iPhone 6.7" (15 Pro Max) | 1290 × 2796 | 3 to 5 |
| iPhone 6.5" (11 Pro Max) | 1284 × 2778 or 1242 × 2688 | 3 to 5 |
| iPad Pro 12.9" (6th gen) | 2048 × 2732 | 3 to 5, only because `TARGETED_DEVICE_FAMILY = "1,2"` includes iPad |

Suggested order: resident home with an open request, the report-an-issue form
with a photo attached, the office pulse view, a contractor's job card, an
inspection report.

**Do not screenshot production.** The employee view shows real residents'
names and addresses. Run the app locally with `BUILDIUM_LIVE=false` and the
Supabase variables blanked so it falls back to the fictional demo data, and
screenshot that.

If iPad screenshots are a hassle, set `TARGETED_DEVICE_FAMILY = "1"` in
`project.pbxproj` (iPhone only) and Apple stops asking for them.

## 6. The review-account problem — needs a decision

Apple will not review an app they cannot get into, and a reviewer cannot receive
a sign-in link sent to a flemingrealty.org mailbox. So the review account must
use the password path, and it has to land somewhere that looks like a real,
working app, or it fails Guideline 4.2 for being empty.

| Option | Problem |
|---|---|
| Give them a staff account | Hands every resident's name, address and balance to an Apple reviewer |
| Match them to a real tenant | Same problem for one person, and that person never agreed to it |
| Leave them unmatched | They see "Pending assignment" and an empty app, which is exactly what 4.2 rejects |
| **Placeholder tenant on a vacant unit** | Clean. Ask Steve to add a tenant named "App Review" with email `appreview@flemingrealty.org` to any vacant unit in Buildium. The app matches it as a resident with a real unit and no real person behind it. Then set a password on that account and give Apple the details. |

The last row is the recommendation. It is a five-minute job for the office and
it keeps real people's data out of the review.

---

## 7. Google Play Console

| Field | Value |
|---|---|
| App name (30) | `Stephen Fleming Realty` |
| Short description (80) | `Report repairs, track requests and see your lease. For Stephen Fleming Realty.` |
| Full description (4000) | Same text as the App Store description above |
| Category | Business |
| Contact email | inspections@dangelore.com |
| Privacy policy | `https://www.flemingrealty.org/privacy` |
| Content rating | Complete the IARC questionnaire; every answer is "No"; result is Everyone |
| Target audience | 18 and over (it is a tenancy tool, not for children) |
| Ads | No |

**Data safety** (mirrors the Apple label):

| Data | Collected | Shared | Purpose |
|---|---|---|---|
| Name, Email, Phone, Address | Yes | No | App functionality |
| Photos | Yes | No | App functionality |
| Financial info (balances) | Yes | No | App functionality |

Data is encrypted in transit (HTTPS throughout) and users can request deletion
in-app (Profile > Delete my account). Tick both.

**Screenshots:** phone 1080 × 1920 minimum, at least 2; a 1024 × 500 feature
graphic is mandatory. The same five screens as iOS, at Android's size.

**Play still needs:** the $25 developer account, the upload keystore created and
added to Codemagic as `fleming_upload_keystore`, and a D-U-N-S check for the
organisation account, which already exists (084866185) from the Apple
enrollment.
