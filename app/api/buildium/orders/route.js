import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { isBuildiumLive } from "@/lib/env";
import { isCurrentTenancy } from "@/lib/buildium/real";
import { setWriteActor } from "@/lib/buildium/writeLog";
import { addAttachment, taskIdOf } from "@/lib/orderAttachments";

// Create a work order. Residents may submit their own; employees may log any.
export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "resident"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted to create work orders." }, { status: 403 });
  }

  const input = await request.json().catch(() => ({}));
  // Nothing the browser sends decides where a ticket lands or what state it is
  // created in. Category ids are derived from the chip label server-side, and
  // status is whitelisted to the three urgency keys the form actually offers —
  // it used to be passed through and relied on a clamp two files away, which is
  // one refactor from being a way to file an already-closed request.
  delete input.categoryId;
  delete input.subCategoryId;
  if (!["urgent", "pending", "scheduled"].includes(input.status)) input.status = "pending";

  // Residents can only file against their own unit — identity comes from the
  // session, never from the request body.
  if (me.role === "resident") {
    input.residentName = me.entity?.name || null;
    input.residentId = me.entity?.tenantId ?? null;
    input.leaseId = me.entity?.leaseId ?? null;
    if (me.entity?.unit && me.entity.unit !== "Pending assignment") input.unit = me.entity.unit;
    if (me.entity?.address && !["—", "-"].includes(me.entity.address)) input.address = me.entity.address;
  } else if (me.role === "employee") {
    // Staff file on a resident's behalf, so the lease and tenant come from the
    // unit picker rather than the session. Coerce here: Buildium rejects string
    // ids, and a malformed value should fail as "not linked to a unit" rather
    // than as an opaque error from the mapper.
    const id = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
    input.leaseId = id(input.leaseId);
    input.residentId = id(input.residentId);

    // And the pair must actually be a current tenancy. Buildium will happily
    // accept two ids that exist separately, which would file this resident's
    // complaint against a different resident's lease.
    if (isBuildiumLive() && input.leaseId != null && input.residentId != null) {
      let ok = false;
      try { ok = await isCurrentTenancy(input.leaseId, input.residentId); }
      catch { return NextResponse.json({ error: "Couldn't confirm that unit's current tenant. Try again." }, { status: 502 }); }
      if (!ok) {
        return NextResponse.json(
          { error: "That unit and resident don't match a current tenancy. Re-pick the unit and try again." },
          { status: 409 }
        );
      }
    }
  }

  // The photo was already uploaded by PhotoCapture; only its storage path
  // travels here. It must be one this account uploaded under the request
  // kind, so nobody can attach somebody else's inspection photo to a ticket.
  const photo = typeof input.photo === "string" && input.photo.startsWith(`request/${me.id}/`) ? input.photo : null;
  delete input.photo;

  try {
    setWriteActor({ email: me.email, role: me.role });
    const order = await buildium().createOrder(input);

    // Buildium holds the ticket; the photo of the problem lives with us. If
    // this insert fails the ticket still exists, so say exactly that rather
    // than pretending the whole thing failed or that the photo is there.
    let photoSaved = !photo;
    if (photo) {
      const taskId = taskIdOf(order?.id);
      try { await addAttachment({ taskId, kind: "request", path: photo, me }); photoSaved = true; }
      catch { photoSaved = false; }
    }
    return NextResponse.json({
      order: photoSaved && photo ? { ...order, photos: [photo] } : order,
      photoSaved,
      ...(photoSaved ? {} : { warning: "Your request was filed, but the photo didn't attach. The office can still see the request." }),
    });
  } catch (e) {
    // A resident whose account isn't linked to a lease can't have a ticket filed
    // for them — say so plainly instead of failing silently.
    const expected = ["BUILDIUM_IDENTITY_REQUIRED", "BUILDIUM_WRITES_HALTED"];
    const status = expected.includes(e?.code) ? 409 : 502;
    return NextResponse.json({ error: e?.message || "Could not create the work order." }, { status });
  } finally {
    setWriteActor(null);
  }
}
