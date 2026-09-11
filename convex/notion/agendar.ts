import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Queue a desk render after an order changed. The order flow never waits on
 * Notion: the render runs as a scheduled action with its own retries (#12).
 */
export async function agendarRender(
  ctx: MutationCtx,
  encomendaId: Id<"installerOrders">,
  evento: string,
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.notion.sync.renderizar, {
    encomendaId,
    evento,
  });
}
