/**
 * Clerk Backend API (REST) for organization create/delete.
 * `fetch` is available in the default Convex action runtime — no "use node".
 */

const CLERK_API = "https://api.clerk.com/v1";

function secretKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) {
    throw new Error("CLERK_SECRET_KEY is not set on the Convex deployment");
  }
  return key;
}

type ClerkErrorBody = {
  errors?: Array<{ message?: string; long_message?: string; code?: string }>;
};

async function clerkRequest(
  path: string,
  init: RequestInit,
): Promise<Response> {
  return await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function clerkErrorMessage(response: Response): Promise<string> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return `Clerk API ${response.status}`;
  }
  const errors = (body as ClerkErrorBody).errors;
  const first = errors?.[0];
  return first?.long_message ?? first?.message ?? `Clerk API ${response.status}`;
}

export type ClerkOrganization = {
  id: string;
  name: string;
  slug: string | null;
};

export async function criarOrganizacaoClerk(args: {
  name: string;
  createdBy: string;
  slug: string;
}): Promise<ClerkOrganization> {
  const response = await clerkRequest("/organizations", {
    method: "POST",
    body: JSON.stringify({
      name: args.name,
      created_by: args.createdBy,
      slug: args.slug,
    }),
  });

  if (!response.ok) {
    throw new Error(await clerkErrorMessage(response));
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    typeof body.id !== "string"
  ) {
    throw new Error("Clerk API returned an organization without an id");
  }

  const slug =
    "slug" in body && typeof body.slug === "string" ? body.slug : null;
  const name =
    "name" in body && typeof body.name === "string" ? body.name : args.name;

  return { id: body.id, name, slug };
}

/** Best-effort cleanup when Convex insert fails after Clerk create. */
export async function apagarOrganizacaoClerk(orgId: string): Promise<void> {
  const response = await clerkRequest(`/organizations/${orgId}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    console.error(
      "Failed to roll back Clerk organization",
      orgId,
      await clerkErrorMessage(response),
    );
  }
}
