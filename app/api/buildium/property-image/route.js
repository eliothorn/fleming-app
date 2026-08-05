// The broker's own photo of a property, if they have uploaded one.
//
// Real photography is the honest way to make this feel like the company's own
// app: an owner recognises their own building. There is deliberately no stock
// fallback — a handsome building that isn't theirs is a lie they would spot.
// When no photo exists (~40% of the portfolio) this 404s and the card keeps its
// typographic tile.
//
// This serves the BYTES rather than handing back Buildium's signed link.
// Measured, those links expire after 302 seconds, so a URL given to the browser
// is usually dead before it is used — and each mint costs two Buildium requests
// against a 10/s limit. Proxying lets the response carry a long private cache
// header instead, so a given viewer fetches a property's photo about once a day
// and Buildium is touched that rarely.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  // Only the roles that see property cards. Nothing here is sensitive, but
  // there's no reason to let other roles enumerate the portfolio.
  if (!["employee", "owner"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const propertyId = new URL(request.url).searchParams.get("propertyId");
  if (!propertyId) return NextResponse.json({ error: "A property is required." }, { status: 400 });

  try {
    const url = await buildium().propertyImageUrl(propertyId);
    if (!url) return new NextResponse(null, { status: 404 });

    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) return new NextResponse(null, { status: 404 });

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Content-Length": String(body.byteLength),
        // Private, not public: the response is behind an auth check, so it must
        // never be held in a shared cache where it would bypass that.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    // A missing or unreachable photo is not an error worth surfacing — the card
    // simply keeps its tile.
    return new NextResponse(null, { status: 404 });
  }
}
