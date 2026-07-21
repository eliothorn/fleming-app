// DEV-MODE auth store (used only when Supabase is NOT configured).
//
// In-memory users + sessions, persisted on globalThis so they survive hot reloads.
// Demonstrates the real model: a user signs up with an email, and the backend
// MATCHES that email to a known property-management identity (tenant / owner /
// staff / vendor) to assign their role and the data they can see. Unknown emails
// become a resident with a "pending" unit — exactly the case a manager would link
// in Buildium. Passwords here are plaintext ON PURPOSE: this path never runs in
// production (real deployments use Supabase, which hashes credentials).

const DEV_PASSWORD = "demo1234";

// email → identity. In production this mapping is the email→Buildium-record match.
const KNOWN_PEOPLE = {
  "marcus@fleming.test": { role: "employee", name: "Marcus J.", sub: "Leasing & Inspections" },
  "denise@fleming.test": { role: "employee", name: "Denise K.", sub: "Inspections" },
  "robert@fleming.test": { role: "owner", name: "Robert H.", sub: "Portfolio · 3 Properties" },
  "sarah@fleming.test": { role: "resident", name: "Sarah M.", unit: "Unit 4B", address: "214 Walnut St" },
  "tom@fleming.test": { role: "resident", name: "Tom B.", unit: "Unit 2A", address: "214 Walnut St" },
  "daflure@fleming.test": { role: "vendor", name: "Daflure HVAC", vendorId: 1, sub: "HVAC · Plumbing Vendor" },
  "jordan@fleming.test": { role: "applicant", name: "Jordan K.", sub: "Prospective Resident" },
};

// The role → demo account used by the "view as" switcher (kept for demos only).
export const DEMO_ACCOUNTS = {
  employee: "marcus@fleming.test",
  resident: "sarah@fleming.test",
  owner: "robert@fleming.test",
  vendor: "daflure@fleming.test",
  applicant: "jordan@fleming.test",
};

function auth() {
  if (!globalThis.__flemingAuth) {
    const users = new Map();
    let seq = 1;
    for (const [email, identity] of Object.entries(KNOWN_PEOPLE)) {
      users.set(email, {
        id: `u${seq++}`,
        email,
        password: DEV_PASSWORD,
        role: identity.role,
        entity: identity,
        matched: true,
      });
    }
    globalThis.__flemingAuth = { users, sessions: new Map(), seq };
  }
  return globalThis.__flemingAuth;
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.entity?.name || u.email, role: u.role, entity: u.entity, matched: u.matched };
}

function issueToken(email) {
  const a = auth();
  const token = `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  a.sessions.set(token, email);
  return token;
}

export function devSignup({ email, password, name }) {
  const a = auth();
  email = String(email || "").trim().toLowerCase();
  if (!email || !password) return { error: "Email and password are required." };
  if (a.users.has(email)) return { error: "An account with that email already exists. Try logging in." };

  const known = KNOWN_PEOPLE[email];
  const entity = known
    ? { ...known, name: known.name }
    : { role: "resident", name: name?.trim() || email.split("@")[0], unit: "Pending assignment", address: "—" };

  const user = {
    id: `u${a.seq++}`,
    email,
    password,
    role: known ? known.role : "resident",
    entity,
    matched: Boolean(known),
  };
  a.users.set(email, user);
  return { token: issueToken(email), user: publicUser(user) };
}

export function devLogin({ email, password }) {
  const a = auth();
  email = String(email || "").trim().toLowerCase();
  const user = a.users.get(email);
  if (!user || user.password !== password) return { error: "Invalid email or password." };
  return { token: issueToken(email), user: publicUser(user) };
}

export function devSessionUser(token) {
  const a = auth();
  const email = token && a.sessions.get(token);
  const user = email && a.users.get(email);
  return user ? publicUser(user) : null;
}

export function devLogout(token) {
  auth().sessions.delete(token);
}

// Demo-only: swap the current session to a seeded role account.
export function devViewAs(role) {
  const email = DEMO_ACCOUNTS[role];
  if (!email) return { error: "Unknown role." };
  const a = auth();
  const user = a.users.get(email);
  return { token: issueToken(email), user: publicUser(user) };
}
