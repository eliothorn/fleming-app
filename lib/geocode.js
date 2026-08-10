// Turn a property's address into coordinates, once.
//
// The 306 addresses are complete (street, city, state, ZIP, all in PA), so they
// geocode cleanly. Results are cached hard: an address does not move, and
// re-geocoding on every page load would burn the free allowance for nothing.
//
// Only ROOFTOP matches are kept. Google returns a result for almost anything —
// interpolating a point along a street when it cannot find the building — and a
// pin on the wrong house is worse than no pin. Anything less precise is dropped
// and reported as unplaced rather than quietly shown in the wrong place.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function mapsConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

function store() {
  return (globalThis.__flGeo ||= new Map()); // address -> {lat,lng,precision,at}
}

export async function geocode(address) {
  if (!mapsConfigured() || !address) return null;
  const key = String(address).trim().toLowerCase();
  const cached = store().get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY);
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json();

    const hit = (body.results || [])[0];
    const precision = hit?.geometry?.location_type || null;
    // ROOFTOP means Google matched the actual building.
    const value =
      hit && precision === "ROOFTOP"
        ? { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng, precision }
        : null;

    store().set(key, { value, at: Date.now() });
    return value;
  } catch {
    return null;
  }
}

// Geocode a batch politely. Google tolerates bursts poorly, so this runs a small
// number at a time rather than firing hundreds at once.
export async function geocodeAll(addresses, { concurrency = 6 } = {}) {
  const out = new Map();
  const queue = [...addresses];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const a = queue.shift();
      out.set(a, await geocode(a));
    }
  });
  await Promise.all(workers);
  return out;
}
