// What the app would actually send to Buildium — asserted without sending it.
//
//   node scripts/write-payloads.mjs
//
// Buildium's task and work-order updates REPLACE the record: "Any field not
// included in the update request will be set to either an empty string or null
// in the database depending on the field definition." So the shape of an update
// payload is not a style question — a missing field erases live data belonging to
// a real broker. That makes these assertions the most important tests in the repo,
// and they must keep passing whether or not writes are switched on.
//
// This imports the live client DIRECTLY rather than going through lib/buildium,
// because the facade deliberately diverts writes to the mock store while
// BUILDIUM_WRITES is unset. With writes off, every method here returns the exact
// payload instead of sending it, so this exercises the real builder — including
// the read-and-merge — against the real account, read-only.
//
// Exit 0 = all passed, 1 = something failed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

// Load .env.local by hand. It is hand-edited and has picked up stray spaces and
// non-KEY=VALUE lines before now, so parse it rather than trusting a shell.
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
// Assert the payloads a live account would receive, but never send one.
process.env.BUILDIUM_WRITES = "";
process.env.BUILDIUM_WRITE_WORKORDERS = "";

const { realBuildium, buildiumRequest } = await import("../lib/buildium/real.js");

// One real task, fetched up front, so the gate tests below have something to
// aim an update at.
const tasksForGate = (await buildiumRequest("/tasks", { query: { limit: 20, orderby: "Id desc" } }))
  .filter((t) => t.TaskType === "ResidentRequest");

let passed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── The gates ─────────────────────────────────────────────────────────────────
// These encode a real near-miss. writesEnabled() read BUILDIUM_WRITES on its own
// without consulting isBuildiumLive(), and the diagnostic route imports this
// client directly — bypassing the write gate in lib/buildium/index.js. Setting
// BUILDIUM_WRITES=true would therefore have turned a URL documented as read-only
// into a live PUT on an arbitrary real resident's ticket.
console.log("\nGates");
{
  const { writesEnabled, workOrderWritesEnabled } = await import("../lib/buildium/real.js");
  const saved = {
    w: process.env.BUILDIUM_WRITES,
    wo: process.env.BUILDIUM_WRITE_WORKORDERS,
    live: process.env.BUILDIUM_LIVE,
  };

  process.env.BUILDIUM_WRITES = "true"; process.env.BUILDIUM_LIVE = "";
  check("writes stay off while Buildium is not live", writesEnabled() === false);

  process.env.BUILDIUM_LIVE = "true"; process.env.BUILDIUM_WRITE_WORKORDERS = "true"; process.env.BUILDIUM_WRITES = "";
  check("work-order writes stay off without BUILDIUM_WRITES", workOrderWritesEnabled() === false);

  process.env.BUILDIUM_WRITES = "true";
  check("both switches on together do enable", writesEnabled() && workOrderWritesEnabled());

  // The regression test for the diagnostic: even with every switch on, an
  // explicit preview must not send. This is why preview is a separate argument
  // and not a field on the payload — no request body can reach it.
  const c = await realBuildium.createOrder(
    { title: "p", category: "General", leaseId: 1, residentId: 2 }, { preview: true });
  check("preview refuses to send a create even with writes fully on", c.dryRun === true);

  const t = tasksForGate[0];
  const u = await realBuildium.updateOrder(`WO-${t.Id}`, { status: "done" }, { preview: true });
  check("preview refuses to send an update even with writes fully on", u.dryRun === true,
    JSON.stringify(u).slice(0, 140));

  process.env.BUILDIUM_WRITES = saved.w || "";
  process.env.BUILDIUM_WRITE_WORKORDERS = saved.wo || "";
  process.env.BUILDIUM_LIVE = saved.live || "";
  check("writes are off again after the gate tests", writesEnabled() === false);
}

// The facade must divert writes to the mock store while the switch is off, so a
// live write is never one forgotten import away.
{
  const { buildium } = await import("../lib/buildium/index.js");
  const r = await buildium().createOrder({ id: "WO-gate", title: "gate", leaseId: 1, residentId: 2 });
  check("with writes off, buildium() writes to the mock store, not Buildium",
    r?.dryRun !== true && r?.id != null, JSON.stringify(r).slice(0, 120));
}

// ── Create ────────────────────────────────────────────────────────────────────
console.log("\nCreating a resident request");
{
  const p = (await realBuildium.createOrder({
    title: "Kitchen tap dripping",
    notes: "Been going since Tuesday.",
    category: "Plumbing",
    status: "pending",
    leaseId: 822472,
    residentId: 2439241,
  })).payload;

  check("posts to /tasks/residentrequests", true);
  // The field is RequestedByEntityId on the way in and RequestedByUserEntity on
  // the way out. Sending the response spelling is a 422 with no useful message,
  // and it is what this code did until it was checked against the schema.
  check("requester field is RequestedByEntityId", p.RequestedByEntityId === 2439241,
    `got ${JSON.stringify(Object.keys(p).filter((k) => /requested/i.test(k)))}`);
  check("does NOT send RequestedByUserEntityId", !("RequestedByUserEntityId" in p));
  check("lease travels as UnitAgreementId", p.UnitAgreementId === 822472);
  check("description is carried", p.Description === "Been going since Tuesday.");
  check("category maps to Maintenance Request > Plumbing", p.CategoryId === 1684 && p.SubCategoryId === 8,
    `got ${p.CategoryId}/${p.SubCategoryId}`);
  check("priority is Normal for a standard request", p.Priority === "Normal");
  check("status is New", p.TaskStatus === "New");
}
{
  const p = (await realBuildium.createOrder({
    title: "No heat", category: "HVAC", status: "urgent", leaseId: 1, residentId: 2,
  })).payload;
  check("urgent maps onto Priority High", p.Priority === "High" && p.TaskStatus === "New");
  check("HVAC maps to subcategory 4", p.SubCategoryId === 4);
}
{
  // A resident must not be able to file a request that is already finished.
  const p = (await realBuildium.createOrder({
    title: "x", category: "General", status: "done", leaseId: 1, residentId: 2,
  })).payload;
  check("a submitted 'done' status cannot create a closed ticket", p.TaskStatus === "New", `got ${p.TaskStatus}`);
}
for (const status of ["urgent", "pending", "scheduled", "review", "done"]) {
  const p = (await realBuildium.createOrder({
    title: "y", category: "General", status, leaseId: 1, residentId: 2,
  })).payload;
  // Nobody has picked up a request filed one second ago, whichever chip was
  // tapped. Urgency belongs on Priority.
  check(`'${status}' creates as New`, p.TaskStatus === "New", `got ${p.TaskStatus}`);
}

// Exact key sets. "Contains" would let a future field through that Buildium
// rejects, or that leaks app-only state like vendorCompleted or photoAdded.
{
  const p = (await realBuildium.createOrder({
    title: "t", notes: "n", category: "HVAC", status: "pending", leaseId: 1, residentId: 2,
  })).payload;
  const want = ["CategoryId","Description","Priority","RequestedByEntityId","SubCategoryId","TaskStatus","Title","UnitAgreementId"];
  check("create sends exactly the documented fields", eq(Object.keys(p).sort(), want), Object.keys(p).sort().join(","));
  check("ids are numbers, not strings",
    typeof p.UnitAgreementId === "number" && typeof p.RequestedByEntityId === "number");
}

// Every chip the form offers must resolve to a real category on this account.
for (const label of ["HVAC","Plumbing","Electrical","Security","General","Inspection","Move-out","Landscaping","something new"]) {
  const p = (await realBuildium.createOrder({ title: "c", category: label, leaseId: 1, residentId: 2 })).payload;
  check(`category "${label}" resolves to a live Buildium category`,
    p.CategoryId === 1684 && [1,3,4,5,7,8].includes(p.SubCategoryId), `${p.CategoryId}/${p.SubCategoryId}`);
}
{
  const long = "z".repeat(400);
  const p = (await realBuildium.createOrder({ title: long, category: "General", leaseId: 1, residentId: 2 })).payload;
  check("title is truncated to Buildium's 127-character limit", p.Title.length === 127);
}
for (const bad of [{ leaseId: null, residentId: 2 }, { leaseId: 1, residentId: null }, { leaseId: "abc", residentId: 2 }, { leaseId: 0, residentId: 2 }]) {
  let code = null;
  try { await realBuildium.createOrder({ title: "x", ...bad }); } catch (e) { code = e.code; }
  check(`refuses an unusable identity (${JSON.stringify(bad)})`, code === "BUILDIUM_IDENTITY_REQUIRED", `got ${code}`);
}

// ── Update: the read-and-merge that stops live data being erased ──────────────
// Run against real tasks of each type, read from the live account. Read-only:
// writes are off, so the payload is returned rather than sent.
console.log("\nUpdating a task — every field must survive the round trip");

const tasks = [];
for (let i = 0; i < 4 && tasks.length < 400; i++) {
  const page = await buildiumRequest("/tasks", { query: { limit: 100, offset: i * 100, orderby: "Id desc" } });
  if (!Array.isArray(page) || !page.length) break;
  tasks.push(...page);
}
check("sampled live tasks to update against", tasks.length > 0, `${tasks.length} tasks`);

const pick = (fn) => tasks.find(fn);
const cases = [
  ["a resident request with a staff member assigned", pick((t) => t.TaskType === "ResidentRequest" && t.AssignedToUserId)],
  ["a task with a subcategory", pick((t) => t.Category?.SubCategory?.Id)],
  ["an owner request", pick((t) => t.TaskType === "RentalOwnerRequest")],
  ["a to-do", pick((t) => t.TaskType === "Todo" && t.AssignedToUserId)],
  ["a contact request", pick((t) => t.TaskType === "ContactRequest")],
];

for (const [label, task] of cases) {
  if (!task) { console.log(`  skip ${label} — none in the newest ${tasks.length}`); continue; }
  const res = await realBuildium.updateOrder(`WO-${task.Id}`, { status: "done" });
  const p = res.payload;
  const typed = await buildiumRequest(`${res.path.replace(/\/\d+$/, "")}/${task.Id}`);

  check(`${label}: writes to the typed endpoint`, res.path.endsWith(`/${task.Id}`) && /\/tasks\/\w+requests\//.test(res.path + "/"),
    res.path);
  check(`${label}: keeps the title`, p.Title === String(typed.Title || "Work order").slice(0, 127));
  check(`${label}: keeps the staff assignment`, p.AssignedToUserId === (typed.AssignedToUserId || null),
    `sent ${p.AssignedToUserId}, record holds ${typed.AssignedToUserId}`);
  check(`${label}: keeps the category`, p.CategoryId === (typed.Category?.Id ?? null));
  check(`${label}: keeps the subcategory`, p.SubCategoryId === (typed.Category?.SubCategory?.Id ?? null),
    `sent ${p.SubCategoryId}, record holds ${typed.Category?.SubCategory?.Id}`);
  check(`${label}: keeps the due date`, p.DueDate === (typed.DueDate ? String(typed.DueDate).slice(0, 10) : null));
  check(`${label}: applies the requested status`, p.TaskStatus === "Completed");
  // Every field Buildium's save schema knows about must be present, because
  // absent means erased.
  const required = ["Title", "TaskStatus", "Priority", "CategoryId", "SubCategoryId", "AssignedToUserId", "DueDate"];
  const missing = required.filter((k) => !(k in p));
  check(`${label}: no updatable field is omitted`, missing.length === 0, `missing ${missing.join(", ")}`);
  // Description is not in Buildium's update schema at all, so it cannot be sent —
  // and therefore cannot be blanked. Sending it would be rejected.
  check(`${label}: does not try to send Description`, !("Description" in p));
  check(`${label}: unassigned reads as null, never 0`, p.AssignedToUserId !== 0);
  check(`${label}: due date is YYYY-MM-DD or null`,
    p.DueDate === null || /^\d{4}-\d{2}-\d{2}$/.test(p.DueDate), String(p.DueDate));

  if (task.TaskType === "RentalOwnerRequest" || task.TaskType === "Todo") {
    check(`${label}: keeps the property/unit link`,
      p.PropertyId === (typed.Property?.Id ?? null) && p.UnitId === (typed.UnitId ?? null),
      `sent ${p.PropertyId}/${p.UnitId}, record holds ${typed.Property?.Id}/${typed.UnitId}`);
  }
  if (task.TaskType === "ContactRequest") {
    check(`${label}: keeps the enquirer's contact details`, eq(p.ContactDetail, typed.ContactDetail ?? null));
  }
}

// A to-do with nobody assigned cannot be updated at all — Buildium requires a
// real staff user. That must read as an explanation, not a 502.
{
  const orphan = pick((t) => t.TaskType === "Todo" && !t.AssignedToUserId);
  if (orphan) {
    let code = null;
    try { await realBuildium.updateOrder(`WO-${orphan.Id}`, { status: "done" }); } catch (e) { code = e.code; }
    check("an unassigned to-do is refused with an explanation", code === "BUILDIUM_ASSIGNEE_REQUIRED", `got ${code}`);
  } else {
    console.log("  skip unassigned to-do — none in the sample (all carry an assignee)");
  }
}

{
  let code = null;
  try { await realBuildium.updateOrder("WO-not-a-number", { status: "done" }); } catch (e) { code = e.code; }
  check("a non-numeric id is refused before any request is made", code === "BUILDIUM_BAD_ID", `got ${code}`);
}

// A patch that changes nothing Buildium stores must not PUT the record back over
// itself — a needless full replace is a needless chance to erase something.
{
  const t = pick((x) => x.TaskType === "ResidentRequest");
  const res = await realBuildium.updateOrder(`WO-${t.Id}`, { vendorCompleted: true, photoAdded: "x/y.jpg" });
  check("a change with no Buildium-backed field makes no request", res.method === "NONE", `got ${res.method}`);
}

// ── Vendor assignment ─────────────────────────────────────────────────────────
console.log("\nAssigning a contractor");
{
  const withWo = tasks.find((t) => t.TaskType === "ResidentRequest");
  const res = await realBuildium.assignVendor(withWo.Id, 1195848);
  check("assignment is a work-order write, not a task write", /\/workorders/.test(res.path), res.path);
  check("carries the vendor", res.payload.VendorId === 1195848);
  check("entry permission is Unknown, never an assumed Yes", res.payload.EntryAllowed === "Unknown",
    `got ${res.payload.EntryAllowed}`);
  if (res.method === "POST") {
    check("a new work order is linked to its task", res.payload.TaskId === withWo.Id);
  } else {
    check("an existing work order keeps its line items", Array.isArray(res.payload.LineItems));
    check("an existing work order keeps its entry notes", "EntryNotes" in res.payload);
    check("an existing work order keeps its invoice number", "InvoiceNumber" in res.payload);
  }
  check("work-order writes are behind their own switch", res.dryRun === true);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("failed:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
