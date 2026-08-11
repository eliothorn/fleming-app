import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { isBuildiumLive } from "@/lib/env";
import { vendorForTask } from "@/lib/buildium/real";

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

  try {
    const order = await buildium().updateOrder(params.id, patch);
    if (!order) return NextResponse.json({ error: "Work order not found." }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e) {
    // These are answers, not faults: the caller gets told what to do instead.
    const expected = ["BUILDIUM_ASSIGNEE_REQUIRED", "BUILDIUM_UNSUPPORTED_TASK_TYPE", "BUILDIUM_BAD_ID"];
    const status = expected.includes(e?.code) ? 409 : 502;
    return NextResponse.json({ error: e?.message || "Could not update the work order." }, { status });
  }
}
