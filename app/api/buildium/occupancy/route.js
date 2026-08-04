// Who currently occupies the units of one property.
//
// Buildium refuses a maintenance request that doesn't name a lease and a
// requesting tenant. A resident's own request gets both from their session; an
// employee filing on someone's behalf had no way to supply either, so every
// staff-created order would have been rejected the moment writes were enabled.
// This backs the unit/resident picker on the staff work-order form.
//
// Employee-only and read-only: it exposes tenant names against unit numbers.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

// Cold call pages the whole tenant roster before the cache is warm.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.role !== "employee") {
    return NextResponse.json({ error: "Employees only." }, { status: 403 });
  }

  const propertyId = new URL(request.url).searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "A property is required." }, { status: 400 });
  }

  try {
    return NextResponse.json({ units: (await buildium().listOccupancy(propertyId)) || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Could not load the units for that property." },
      { status: 502 }
    );
  }
}
