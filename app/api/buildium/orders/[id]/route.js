import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { isBuildiumLive } from "@/lib/env";
import { vendorForTask } from "@/lib/buildium/real";
import { setWriteActor } from "@/lib/buildium/writeLog";
import { sendPush, userIdForTenant } from "@/lib/push";
import { addAttachment, attachmentsFor, mergeAttachments, taskIdOf } from "@/lib/orderAttachments";

// Update a work order: assign a vendor, mark vendor-complete, close out, etc.
export async function PATCH(request, { params }) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "vendor"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted to modify work orders." }, { status: 403 });
  }

  const patch = await request.json().catch(() => ({}));

  // A contractor may only touch work that is actually theirs. Until now the id
  // came straight off the URL with no ownership check — harmless while updates
  // went to an in-memory mock, but with live writes on it would let any signed-in
  // vendor close, reopen or reassign any of the 2,388 jobs in the account.
  if (me.role === "vendor") {
    const mine = me.entity?.vendorId ?? null;
    if (mine == null) {
      return NextResponse.json({ error: "This account isn't linked to a contractor record yet." }, { status: 403 });
    }
    if (isBuildiumLive()) {
      let owner = null;
      try { owner = await vendorForTask(params.id); }
      catch { return NextResponse.json({ error: "Couldn't confirm this job is yours." }, { status: 502 }); }
      if (owner !== mine) {
        return NextResponse.json({ error: "That job isn't assigned to you." }, { status: 403 });
      }
    }
    // Reassigning is the office's decision, not the contractor's.
    if (patch.vendorId != null && Number(patch.vendorId) !== Number(mine)) {
      return NextResponse.json({ error: "Only the office can reassign a job." }, { status: 403 });
    }
  }

  // A contractor's proof of completion. The photo path must be one this
  // account uploaded under the completion kind.
  const completionPhoto = typeof patch.photoAdded === "string" && patch.photoAdded.startsWith(`completion/${me.id}/`) ? patch.photoAdded : null;
  const completing = Boolean(patch.vendorCompleted) || Boolean(completionPhoto) || Boolean(patch.completionNote);

  try {
    setWriteActor({ email: me.email, role: me.role });
    let order = await buildium().updateOrder(params.id, patch);
    if (!order) return NextResponse.json({ error: "Work order not found." }, { status: 404 });

    // Buildium records the status change but not the photo or the note; those
    // used to be dropped on the floor here, so the office never saw the proof
    // and the contractor saw "Mark work complete" again after a reload.
    let completionSaved = true;
    if (completing) {
      try {
        await addAttachment({ taskId: taskIdOf(params.id), kind: "completion", path: completionPhoto, note: patch.completionNote, me });
      } catch { completionSaved = false; }
    }
    // Hand back the order the way the UI will see it on the next load.
    try { order = mergeAttachments([order], await attachmentsFor([order.id]))[0]; } catch { /* keep the bare order */ }
    if (!completionSaved) {
      return NextResponse.json({ order, warning: "The job was marked complete, but the photo and note didn't save. Please try submitting them again." });
    }

    // Tell the resident their job is finished. Only on the transition to done,
    // and only when someone other than them closed it — which is always, since
    // residents cannot reach this route at all.
    if (patch.status === "done" && order.residentId != null) {
      try {
        const uid = await userIdForTenant(order.residentId);
        if (uid) {
          await sendPush(uid, {
            title: "Your request is closed",
            body: order.title ? `${order.title} has been marked complete.` : "Your maintenance request has been marked complete.",
            url: "/app",
            tag: `order-${order.id}`,
          });
        }
      } catch { /* the update already succeeded; the push is a courtesy */ }
    }

    return NextResponse.json({ order });
  } catch (e) {
    // These are answers, not faults: the caller gets told what to do instead.
    const expected = ["BUILDIUM_ASSIGNEE_REQUIRED", "BUILDIUM_UNSUPPORTED_TASK_TYPE", "BUILDIUM_BAD_ID", "BUILDIUM_WRITES_HALTED"];
    const status = expected.includes(e?.code) ? 409 : 502;
    return NextResponse.json({ error: e?.message || "Could not update the work order." }, { status });
  } finally {
    setWriteActor(null);
  }
}
