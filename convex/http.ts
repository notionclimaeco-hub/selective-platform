import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { pageIdDoWebhook } from "./notion/webhook";

const http = httpRouter();

/**
 * Target of the Notion database automations (#12). The shared secret lives
 * in the URL because Notion automations cannot set headers:
 *   https://<deployment>.convex.site/notion/webhook?secret=<NOTION_WEBHOOK_SECRET>
 * We only take the page id from the payload; the page is re-read via the API.
 */
http.route({
  path: "/notion/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const esperado = process.env.NOTION_WEBHOOK_SECRET;
    const recebido = new URL(request.url).searchParams.get("secret");
    if (!esperado || recebido !== esperado) {
      return new Response("Unauthorized", { status: 401 });
    }

    let corpo: unknown;
    try {
      corpo = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const pageId = pageIdDoWebhook(corpo);
    if (pageId === null) {
      return new Response(null, { status: 202 });
    }
    await ctx.scheduler.runAfter(0, internal.notion.entrada.processarPagina, {
      pageId,
    });
    return new Response(null, { status: 202 });
  }),
});

export default http;
