# Deploying Fleming Realty

Current target: **staff and owners**. Buildium writes are off, so the app is
read-only and tells residents plainly that their requests don't reach the office
yet. Don't invite residents until writes are enabled.

---

## Before you deploy

Run `/api/deploy-check` while signed in as an employee. It must report
`readyToDeploy: true`. It checks session storage, the seeding endpoint, and the
demo-account lockout.

Prerequisites already done:
- `supabase/schema.sql` — profiles table + role trigger
- `supabase/sessions.sql` — **required**; without it sessions fall back to
  memory and people get logged out at random on serverless

---

## Environment variables for Vercel

Add these in **Project → Settings → Environment Variables**. Values come from
your local `.env.local` — copy them across, never commit them.

| Name | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Server-only, never `NEXT_PUBLIC_` |
| `BUILDIUM_CLIENT_ID` | Buildium API key id |
| `BUILDIUM_CLIENT_SECRET` | **Secret.** |
| `BUILDIUM_BASE_URL` | `https://api.buildium.com/v1` |
| `BUILDIUM_LIVE` | `true` to serve real property data |
| `ANTHROPIC_API_KEY` | Optional. Without it the AI receptionist uses a
deterministic parser instead of Claude |

### Deliberately NOT set in production

| Name | Why |
|---|---|
| `ALLOW_DEMO_ACCOUNTS` | The `@fleming.test` accounts share the published password `demo1234` and hold employee/owner roles. Setting this on a public URL exposes real tenant data. |
| `ALLOW_DEMO_SEED` | Would let anyone re-create those accounts. |
| `BUILDIUM_WRITES` | Writes stay off until deliberately enabled. |

---

## After the first deploy

1. **Supabase → Authentication → URL Configuration**
   - Site URL: your Vercel URL
   - Redirect URLs: add `https://<your-app>.vercel.app/auth/callback`
     (magic links and Google both return through this path)
2. **Google sign-in**, if enabled later: add the same Vercel callback to the
   Google Cloud OAuth client's authorised redirect URIs.
3. **Email delivery**: Supabase's built-in sender is rate-limited to a few
   messages an hour and lands in spam more often than not. Before real residents
   use magic links, configure SMTP (Resend, SendGrid, Postmark) under
   Authentication → Emails.
4. Re-run `/api/deploy-check` against the deployed URL and confirm
   `readyToDeploy: true` with demo accounts reported as locked.

---

## Getting yourself an employee account

The demo accounts can't sign in on the deployed site, and `@fleming.test` isn't a
real domain so it can't receive magic links. Sign up with your own email, then
promote it in the Supabase SQL editor:

```sql
update public.profiles
set role = 'employee',
    entity = jsonb_build_object('name', 'Your Name', 'sub', 'Leasing & Inspections'),
    matched = true
where email = 'you@example.com';
```

For demoing other roles, use email aliases you control (e.g.
`you+owner@gmail.com`) and sign in with magic links, then promote each the same
way.

---

## Known limits at this stage

- **Writes are off.** Nothing the app does changes anything in Buildium.
- **Rate limiting is per-instance.** Several concurrent serverless instances
  could collectively exceed Buildium's 10 requests/second. Fine at launch
  traffic; needs a shared limiter if it grows.
- **Caches are per-instance**, so cold loads happen more often than they would
  on a single server. First load takes ~9s; `maxDuration` is raised to 60s on
  the heavy routes to accommodate it.
