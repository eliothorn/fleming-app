// Data-access facade. API routes call THIS, never the store/real client directly,
// so switching to live Buildium is a single decision made here.
//
// Reads that Buildium doesn't own (inspection templates, seeded message threads)
// always come from the local store. Everything else prefers real Buildium when
// keys are configured, and falls back to the mock store otherwise.

import { isBuildiumLive, isBuildiumWriteEnabled } from "../env";
import { mockStore } from "./store";
import { realBuildium } from "./real";

// Methods that change data in the broker's account. These only reach Buildium
// when writes are explicitly switched on; otherwise they're served by the local
// store so the app still works, without touching the real account.
const WRITE_METHODS = new Set(["createOrder", "updateOrder", "assignVendor"]);

export function buildium() {
  if (!isBuildiumLive()) return mockStore;

  // Live mode: use real Buildium where mapped, mock store for app-owned data
  // (templates) and anything not yet mapped, so the app keeps working while the
  // remaining mappers are finished against the sandbox.
  return new Proxy(realBuildium, {
    get(target, prop) {
      // Live reads, but writes stay local until deliberately enabled.
      if (WRITE_METHODS.has(prop) && !isBuildiumWriteEnabled()) {
        return mockStore[prop].bind(mockStore);
      }
      if (typeof target[prop] === "function") return target[prop].bind(target);
      // Not implemented on the real client → fall back to the mock store method.
      if (typeof mockStore[prop] === "function") return mockStore[prop].bind(mockStore);
      return undefined;
    },
  });
}
