import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Desk reconciliation (#12): re-render open tickets, adopt rows added by
// hand, and pick up Ação values whose webhook never arrived.
crons.interval(
  "notion desk reconciliation",
  { minutes: 15 },
  internal.notion.sync.reconciliar,
  {},
);

// Payment reconciliation (#8): orders past their 7-day window whose Revolut
// webhook never arrived — read the order state from Revolut and apply it.
crons.interval(
  "revolut payment reconciliation",
  { hours: 1 },
  internal.revolut.fluxo.reconciliar,
  {},
);

export default crons;
