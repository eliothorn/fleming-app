// Branded sign-in link that works in ANY browser.
//
// Two problems with the previous arrangement, both of which a resident hits on
// a phone:
//
//   1. The emailed link pointed at
//      https://<project-ref>.supabase.co/auth/v1/verify?token=… — a random
//      string on a domain the resident has never heard of. That reads as
//      phishing, which is the worst possible first impression for an app asking
//      someone to sign in.
//
//   2. It only worked in the browser that asked for it. The browser client uses
//      PKCE, which stashes a verifier in that browser's storage; the emailed
//      link then has to be opened in the same one. In practice a resident taps
//      the button in Safari and opens the mail in Gmail, whose in-app browser is
//      a different browser entirely — so the link dead-ends.
//
// This route fixes both. Supabase's email template can hand back a
// {{ .TokenHash }} instead of a pre-baked URL, so the link can point at this
// app's own domain, and the token is exchanged HERE, on the server, with
// verifyOtp. Nothing is read from browser storage, so it does not matter which
// browser opens it — or whether it is opened on a different device altogether.
//
// The template that produces these links lives in Supabase → Authentication →
// Email Templates; see supabase/email-templates/ for the markup to paste.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { getAnonSupabase } from "@/lib/auth/supabase";
import { supaSessionFromAccessToken } from "@/lib/auth/supabaseBackend";
import { consumeSigninLink } from "@/lib/auth/signinLinks";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Supabase names this differently depending on what was sent; accept the lot
// rather than dead-ending someone on a technicality.
const ALLOWED_TYPES = new Set(["magiclink", "email", "signup", "invite", "recovery", "email_change"]);

export async function GET(request) {
  const url = new URL(request.url);
  const back = (message) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  if (!isSupabaseConfigured()) return back("Sign-in links aren't configured on this deployment.");

  const tokenHash = url.searchParams.get("token_hash") || url.searchParams.get("token");
  const rawType = String(url.searchParams.get("type") || "magiclink").toLowerCase();
  const type = ALLOWED_TYPES.has(rawType) ? rawType : "magiclink";

  if (!tokenHash) return back("That sign-in link looks incomplete. Please request a new one.");

  // Spend the link before verifying it. Supabase will happily redeem the same
  // token hash more than once — measured, three uses produced three valid
  // sessions — so without this an emailed link stays a working key for its whole
  // lifetime, and a forwarded email is account access.
  if (!(await consumeSigninLink(tokenHash))) {
    return back("That sign-in link has already been used. Please request a new one.");
  }

  let accessToken = null;
  try {
    const { data, error } = await getAnonSupabase().auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      // Expiry and reuse are the ordinary cases and deserve plain words rather
      // than Supabase's wording.
      const msg = /expired|invalid/i.test(error.message || "")
        ? "That sign-in link has expired or was already used. Please request a new one."
        : error.message;
      return back(msg);
    }
    accessToken = data?.session?.access_token || null;
  } catch {
    return back("We couldn't complete that sign-in. Please request a new link.");
  }

  if (!accessToken) return back("That sign-in link has expired. Please request a new one.");

  // Reuse the one path that turns a verified Supabase identity into this app's
  // own session — it also applies the demo-account lockout and links the person
  // to their Buildium record.
  const result = await supaSessionFromAccessToken(accessToken);
  if (result.error) return back(result.error);

  cookies().set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.redirect(new URL("/app", url.origin));
}
