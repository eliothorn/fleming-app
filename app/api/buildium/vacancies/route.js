// Units a resident could move into.
//
// Signed-in users only — this is the office's marketing list, not public. It is
// deliberately limited to units the office has put a rent against; a unit merely
// lacking a lease is usually mid-turnover, not available, and listing those
// would generate enquiries about flats nobody is letting.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    return NextResponse.json({ vacancies: (await buildium().listVacancies()) || [] });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Could not load available units." },
      { status: 502 }
    );
  }
}
