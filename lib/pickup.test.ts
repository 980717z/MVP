import { describe, it, expect } from "vitest";
import { pickupStep } from "./pickup";

// The tracker's whole UI (stepper, progress bar, headline) derives from this
// one function, so pin every state transition: new→1, preparing→2, ready→3,
// picked-up→4, and make sure the later timestamps always win over status.
describe("pickupStep", () => {
  const base = { status: "new", ready_at: null, picked_up_at: null };

  it("new order (just placed) → step 1", () => {
    expect(pickupStep(base)).toBe(1);
  });

  it("accepted / preparing → step 2", () => {
    expect(pickupStep({ ...base, status: "preparing" })).toBe(2);
  });

  it("ready_at set → step 3 (even while status is still 'preparing')", () => {
    expect(pickupStep({ status: "preparing", ready_at: "2026-07-14T18:00:00Z", picked_up_at: null })).toBe(3);
  });

  it("picked_up_at set → step 4 (wins over ready_at and status)", () => {
    expect(pickupStep({ status: "preparing", ready_at: "2026-07-14T18:00:00Z", picked_up_at: "2026-07-14T18:05:00Z" })).toBe(4);
  });

  it("picked up even if ready_at was never stamped → still step 4", () => {
    expect(pickupStep({ status: "done", ready_at: null, picked_up_at: "2026-07-14T18:05:00Z" })).toBe(4);
  });

  it("a 'done' status without picked_up_at does NOT imply picked up", () => {
    // status is intentionally not consulted beyond 'preparing'; only the
    // timestamps promote past step 2, so a stray done+no-timestamp stays low.
    expect(pickupStep({ status: "done", ready_at: null, picked_up_at: null })).toBe(1);
  });
});
