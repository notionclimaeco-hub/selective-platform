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

export default crons;
