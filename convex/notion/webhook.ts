/**
 * Notion automation "Send webhook" payloads wrap the triggering page as
 * `data` (a page object). Integration webhooks use `entity`. We accept both
 * and only ever extract the page id.
 */
export function pageIdDoWebhook(corpo: unknown): string | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const c = corpo as { data?: unknown; entity?: unknown };
  for (const candidato of [c.data, c.entity]) {
    if (typeof candidato !== "object" || candidato === null) continue;
    const { id, object } = candidato as { id?: unknown; object?: unknown };
    if (typeof id === "string" && id.length > 0 && (object === undefined || object === "page")) {
      return id;
    }
  }
  return null;
}
