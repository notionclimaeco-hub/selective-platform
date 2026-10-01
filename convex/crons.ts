import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Payment reconciliation (#8): orders past their 7-day window whose Revolut
// webhook never arrived — read the order state from Revolut and apply it.
crons.interval(
  "revolut payment reconciliation",
  { hours: 1 },
  internal.revolut.fluxo.reconciliar,
  {},
);

export default crons;
