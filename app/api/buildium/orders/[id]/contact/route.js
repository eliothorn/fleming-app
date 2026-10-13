// The resident's phone number for one work order.
//
// Contractors used to be told "contact the office for scheduling", which meant
// a three-way phone relay through a four-person office for every job. The
// broker was asked whether he was comfortable with residents' numbers reaching
// his contractors and said yes in writing on 2026-10-12.
//
// That consent is about contractors seeing the resident on THEIR job, so this
// is a per-order lookup behind the same ownership check as updating the order,
// not a field added to the orders payload. Three consequences, all deliberate:
// a vendor can only ever read the number for a job assigned to them; the number
// is fetched when someone actually needs to ring it rather than sitting in
// every browser that loaded the app; and residents and owners cannot reach this
// route at all.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { isBuildiumLive } from "@/lib/env";
import { buildiumRequest, vendorForTask } from "@/lib/buildium/real";
import { taskIdOf } from "@/lib/orderAttachments";

export const dynamic = "force-dynamic";

const digits = (s) => String(s || "").replace(/[^\d+]/g, "");

export async function GET(request, { params }) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "vendor"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }
  if (!isBuildiumLive()) {
    return NextResponse.json({ error: "Contact details come from Buildium, which isn't live here." }, { status: 409 });
  }

  const taskId = taskIdOf(params.id);
  if (taskId == null) return NextResponse.json({ error: "That isn't a work order id." }, { status: 400 });

  // A contractor may only see the resident on their own job. Same rule as the
  // PATCH route, and for the same reason: without it, any signed-in vendor
  // could read the contact details of every resident in the portfolio.
  if (me.role === "vendor") {
    const mine = me.entity?.vendorId ?? null;
    if (mine == null) {
      return NextResponse.json({ error: "This account isn't linked to a contractor record yet." }, { status: 403 });
    }
    let owner = null;
    try { owner = await vendorForTask(taskId); }
    catch { return NextResponse.json({ error: "Couldn't confirm this job is yours." }, { status: 502 }); }
    if (owner !== mine) {
      return NextResponse.json({ error: "That job isn't assigned to you." }, { status: 403 });
    }
  }

  try {
    // Who raised it comes from the task itself, never from the caller: a tenant
    // id in the request would let a vendor read any resident they could guess.
    const task = await buildiumRequest(`/tasks/${taskId}`);
    const tenantId = task?.RequestedByUserEntity?.Id ?? null;
    // Buildium calls this "RentalTenant", not "Tenant" — measured on live tasks.
    // Matching loosely on "tenant" keeps RentalOwner requests out, which is the
    // distinction that matters: an owner's request has no resident to ring.
    const type = String(task?.RequestedByUserEntity?.Type || "");
    if (tenantId == null || !/tenant/i.test(type)) {
      return NextResponse.json({ contact: null, note: "No resident is recorded against this job." });
    }

    const tenant = await buildiumRequest(`/leases/tenants/${tenantId}`);
    const phones = Array.isArray(tenant?.PhoneNumbers) ? tenant.PhoneNumbers : [];
    // Mobile first: these numbers are rung by someone standing at the door.
    const best =
      phones.find((p) => /mobile|cell/i.test(p?.Type || ""))?.Number ||
      phones[0]?.Number || null;

    return NextResponse.json({
      contact: {
        name: [tenant?.FirstName, tenant?.LastName].filter(Boolean).join(" ") || "Resident",
        phone: best || null,
        tel: best ? digits(best) : null,
        email: tenant?.Email || null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Couldn't load the resident's details." }, { status: 502 });
  }
}
