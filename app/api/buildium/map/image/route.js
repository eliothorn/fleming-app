// The map image itself, proxied.
//
// The Google key is restricted to the server and must not reach the browser, so
// this builds the Static Maps URL here and streams back the PNG — the same
// pattern the property photos already use.
//
// Markers are coloured by urgency so the picture answers "where is the trouble"
// at a glance rather than just "where are the buildings".
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { geocodeAll, mapsConfigured } from "@/lib/geocode";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_PINS = 40;

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return new NextResponse("Not authenticated", { status: 401 });
  if (!["employee", "owner"].includes(me.role)) return new NextResponse("Not permitted", { status: 403 });
  if (!mapsConfigured()) return new NextResponse("Mapping not configured", { status: 503 });

  const { searchParams } = new URL(request.url);
  const width = Math.min(Number(searchParams.get("w")) || 640, 640);
  const height = Math.min(Number(searchParams.get("h")) || 420, 640);

  try {
    const props = await buildium().listProperties();
    const busy = props
      .filter((p) => (p.openOrders || 0) > 0)
      .sort((a, b) => (b.urgentOrders || 0) - (a.urgentOrders || 0) || (b.openOrders || 0) - (a.openOrders || 0))
      .slice(0, MAX_PINS);

    const coords = await geocodeAll(busy.map((p) => p.address).filter(Boolean));
    const urgent = [];
    const normal = [];
    for (const p of busy) {
      const hit = p.address ? coords.get(p.address) : null;
      if (!hit) continue;
      (p.urgentOrders > 0 ? urgent : normal).push(`${hit.lat.toFixed(6)},${hit.lng.toFixed(6)}`);
    }
    if (!urgent.length && !normal.length) return new NextResponse("Nothing to place", { status: 404 });

    const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
    url.searchParams.set("size", `${width}x${height}`);
    url.searchParams.set("scale", "2");
    url.searchParams.set("maptype", "roadmap");
    if (normal.length) url.searchParams.append("markers", `color:0x0D1B33|${normal.join("|")}`);
    if (urgent.length) url.searchParams.append("markers", `color:0xB91C1C|${urgent.join("|")}`);
    url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return new NextResponse("Map unavailable", { status: 502 });

    return new NextResponse(await res.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/png",
        // Positions change slowly; a short cache keeps repeat views free.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch {
    return new NextResponse("Map unavailable", { status: 502 });
  }
}
