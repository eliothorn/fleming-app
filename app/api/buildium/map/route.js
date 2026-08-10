// Where the work actually is.
//
// A pin for every one of the 306 properties would be an unreadable smear over
// central Pennsylvania and would cost 306 geocodes. The useful question for
// somebody running the office is "where is the open work today", so this places
// the properties that currently have open jobs, busiest first, and caps the
// number placed.
//
// Anything Google cannot match to an actual building is returned as unplaced
// rather than pinned approximately — a marker on the wrong house is worse than
// an honest gap.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { geocodeAll, mapsConfigured } from "@/lib/geocode";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_PINS = 40;

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "owner"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }
  if (!mapsConfigured()) {
    return NextResponse.json({ error: "Mapping isn't configured on this deployment." }, { status: 503 });
  }

  try {
    const props = await buildium().listProperties();
    const busy = props
      .filter((p) => (p.openOrders || 0) > 0)
      .sort((a, b) => (b.urgentOrders || 0) - (a.urgentOrders || 0) || (b.openOrders || 0) - (a.openOrders || 0))
      .slice(0, MAX_PINS);

    const coords = await geocodeAll(busy.map((p) => p.address || p.name).filter(Boolean));

    const points = [];
    const unplaced = [];
    for (const p of busy) {
      const hit = coords.get(p.address || p.name);
      if (hit) points.push({ id: p.id, name: p.name, lat: hit.lat, lng: hit.lng, openOrders: p.openOrders, urgentOrders: p.urgentOrders });
      else unplaced.push(p.name);
    }

    return NextResponse.json({
      points,
      unplaced,
      consideredWithOpenWork: props.filter((p) => (p.openOrders || 0) > 0).length,
      capped: MAX_PINS,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Could not build the map." }, { status: 502 });
  }
}
