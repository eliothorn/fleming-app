// Register or remove this device for notifications.
//
// Everything is scoped to the signed-in user from the session cookie — the body
// never says who the subscription belongs to, so one account cannot register a
// device against another.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { saveSubscription, removeSubscription, countSubscriptions, pushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({
    configured: pushConfigured(),
    devices: await countSubscriptions(me.id),
  });
}

export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!pushConfigured()) {
    return NextResponse.json({ error: "Notifications aren't set up on the server yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const res = await saveSubscription(me.id, body.subscription, request.headers.get("user-agent"));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });

  return NextResponse.json({ ok: true, devices: await countSubscriptions(me.id) });
}

export async function DELETE(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  await removeSubscription(me.id, endpoint || null);
  return NextResponse.json({ ok: true, devices: await countSubscriptions(me.id) });
}
