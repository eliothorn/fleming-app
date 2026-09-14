// What an owner is allowed to see: their own properties, and nothing else.
//
// The matcher stores an owner's Buildium property ids on their profile
// (lib/buildium/matcher.js, entity.propertyIds) but until now nothing read
// them except the balance figure, so an owner with one duplex received the
// whole brokerage — every property's rent roll, every resident's work orders,
// every inspection report with interior photos. This is the single seam that
// narrows all of that.
//
// Inspections are stored by property NAME (supabase/inspections.sql), so the
// scope carries names as well as ids. Names are resolved from the property
// list, which lib/buildium/real.js caches for ten minutes, so the cost after
// the first call is nil.
//
// Live mode only. The demo owner has no propertyIds and demo mode is meant to
// be self-consistent, so there the owner keeps the seeded portfolio.
import { isBuildiumLive } from "./env";

export function isScopedOwner(me) {
  return me?.role === "owner" && isBuildiumLive();
}

// Returns { ids:Set<number>, names:Set<string> } for an owner in live mode,
// or null when no scoping applies. An owner whose profile predates ids
// carrying through (entity.propertyIds missing) gets an empty scope, i.e.
// nothing, which the UI already handles; that is the safe direction.
export async function ownerScope(me, properties) {
  if (!isScopedOwner(me)) return null;
  const ids = new Set((me.entity?.propertyIds || []).map(Number).filter(Number.isFinite));
  const names = new Set();
  for (const p of properties || []) {
    if (ids.has(Number(p.id)) && p.name) names.add(p.name);
  }
  return { ids, names };
}

export const inScope = (scope, propertyId) => scope.ids.has(Number(propertyId));
export const nameInScope = (scope, propertyName) => scope.names.has(propertyName);
