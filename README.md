# Fleming Realty — property management app

A Next.js + Supabase app for Fleming Realty Group. Five roles (employee, resident,
owner, vendor, applicant) share one product: work orders, inspections, the AI
receptionist, and resident services.

It is built to run **today in dev mode** (mock auth + mock property data) and to
flip to **live services** by adding keys to `.env.local` — no code changes needed.

---

## Run it now (dev mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000. You'll land on the login screen.

**Demo accounts** (password `demo1234` for all) — or tap one on the login screen:

| Role      | Email                 |
|-----------|-----------------------|
| Employee  | marcus@fleming.test   |
| Resident  | sarah@fleming.test    |
| Owner     | robert@fleming.test   |
| Vendor    | daflure@fleming.test  |
| Applicant | jordan@fleming.test   |

You can also **sign up with any email** to see the new-resident flow (the account
is created and, because the email isn't a known tenant, shows a "pending unit
assignment" state — exactly what a manager would link in Buildium).

Inside the app, the **Profile tab → "Demo · view as"** switcher lets one person
walk a client through all five roles. This switcher disappears automatically in
live mode (real users have exactly one role).

---

## Architecture

```
Browser (Next.js UI)  →  /api/* route handlers (server)  →  Buildium API
        │                         │                         Anthropic API
   auth client              holds all secrets
        │                         │
  Supabase Auth            Supabase (profiles/roles DB)
```

- **The browser never holds a secret.** Buildium and Anthropic keys live only in
  server-side API routes. Buildium is server-to-server only (no CORS), so this is
  mandatory, not optional.
- **Auth is your own** (Supabase). A user signs up with email; the backend matches
  that email to a Buildium record (tenant / owner / staff / vendor) to assign role
  and scope data. Buildium has no "log in with Buildium" — this is the correct model.
- **One data facade** (`lib/buildium/index.js`) decides mock vs. live, so switching
  is a single seam.

Key files:
- `lib/env.js` — feature detection (which services are configured)
- `lib/auth/*` — dev auth (now) + Supabase wiring (live)
- `lib/buildium/*` — mock store (now) + real Buildium client (`real.js`)
- `app/api/*` — auth, scoped data (`bootstrap`), mutations, AI receptionist
- `components/PhoneApp.jsx` — the full UI (ported from the approved demo)

---

## Going live

### 1. Supabase (real auth + roles)
1. Create a free project at https://supabase.com.
2. In the SQL editor, run `supabase/schema.sql` (creates the `profiles` table +
   the trigger that assigns a role by matching the new user's email).
3. Project Settings → API: copy the URL, the anon key, and the service role key
   into `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`).
4. Restart `npm run dev`. The app now uses real Supabase Auth; the dev accounts and
   role switcher turn off.

### 1b. Sign-in methods (magic link + Google)

The email address is not just a login here — it's the key that matches a person
to their Buildium tenant/owner/vendor record. That drove the choice of methods.
Measured on the live account: of 1,101 tenant emails, 67% are gmail, 2% icloud,
across 74 distinct domains.

**Magic link — works as soon as Supabase is configured, nothing else needed.**
Passwordless; receiving the mail both verifies the address and guarantees the
Buildium match. This is the default for residents, who sign in rarely and would
otherwise generate password-reset calls to the office.

For production, set a real SMTP sender in Supabase (Authentication → Emails →
SMTP). The built-in sender is rate-limited (a few messages an hour) and mail
from it is more likely to land in spam.

**Google — needs one thing from you:**
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID*
   → Web application.
2. Authorised redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
3. Copy the client ID and secret into Supabase → Authentication → Providers →
   Google → enable and paste.
4. Supabase → Authentication → URL Configuration → add your app's
   `/auth/callback` to **Redirect URLs** (e.g. `http://localhost:3000/auth/callback`
   and your deployed URL).

The login page shows the Google button whenever Supabase is configured; if the
provider isn't enabled yet, Supabase returns a clear error rather than failing
silently.

**Apple was deliberately not implemented.** Only ~2% of tenants use iCloud
addresses, it needs a $99/yr Apple Developer account, and its "Hide My Email"
feature issues a `@privaterelay.appleid.com` alias that would never match a
Buildium record — actively defeating the matcher.

### 2. Buildium (real property data) — requires the broker
1. The broker's Buildium account must be on the **Premium plan** (Open API).
2. An admin creates an API key in **Settings → Developer Tools → API Keys**, scoped
   to: tasks/resident requests, tenants & leases, rental owners, vendors, general
   ledger, inspections. This yields a **client ID + secret**.
3. Put them in `.env.local` (`BUILDIUM_CLIENT_ID`, `BUILDIUM_CLIENT_SECRET`) and set
   `BUILDIUM_BASE_URL` to the **sandbox** first.
4. Finish the field mappings marked `TODO` in `lib/buildium/real.js` against real
   sandbox responses (reads are wired; writes need the exact payload confirmed).
5. Test read → write → email-matching in sandbox, then switch to production.

### 3. Anthropic (AI receptionist)
Add `ANTHROPIC_API_KEY` (from https://console.anthropic.com). Without it, the
receptionist uses a deterministic keyword parser so the flow still demos.

---

## Security notes
- Never commit `.env.local`. Real keys are secrets. (`.gitignore` already excludes it.)
- You're handling PII + financial data. Use HTTPS in production, keep the service
  role and Buildium secret server-side only, and confirm a data-handling
  understanding with the broker before touching production data.

## Status of the live seams
- ✅ Auth: dev complete; Supabase wired (browser auth + server profile lookup).
- ✅ AI receptionist: server-side; Anthropic-or-mock.
- ✅ Data reads via mock store; owner/resident/vendor scoping enforced server-side.
- ⏳ `lib/buildium/real.js`: reads mapped, writes marked TODO — finish against sandbox.
- ⏳ Assign/complete/close work-order writes persist through `/api/buildium/orders`
  (PATCH endpoint live); confirm the Buildium task-status mapping when keys land.
