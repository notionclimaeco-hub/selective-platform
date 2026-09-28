import { useClerk, useOrganization } from "@clerk/tanstack-react-start"

import { Button } from "@/components/ui/button"
import { Seccao } from "./seccao"

const PAPEL: Record<string, string> = {
  "org:admin": "Administrador",
  "org:member": "Membro",
}

/**
 * Members and pending invitations of the company's Clerk organization, as a
 * plain list. "Gerir" opens Clerk's organization modal (invite, change role,
 * remove) on the shared appearance.
 */
export function SeccaoMembros({ pronto }: { pronto: boolean }) {
  const { openOrganizationProfile } = useClerk()
  const { memberships, invitations } = useOrganization({
    memberships: { pageSize: 50, keepPreviousData: true },
    invitations: { pageSize: 50, keepPreviousData: true },
  })
  const membros = memberships?.data ?? []
  const convites = (invitations?.data ?? []).filter(
    (i) => i.status === "pending"
  )
  const aCarregar = !pronto || memberships?.isLoading

  return (
    <Seccao
      id="membros"
      titulo="Membros"
      direita={
        <Button
          variant="outline"
          size="sm"
          disabled={!pronto}
          onClick={() =>
            openOrganizationProfile({
              // Straight to members: the "Geral" page (rename, leave, delete)
              // is not for installers; its danger section is hidden in
              // `clerk-ui.ts`.
              __experimental_startPath: "/organization-members",
            })
          }
        >
          Gerir
        </Button>
      }
    >
      {aCarregar ? (
        <div className="h-10 animate-pulse rounded bg-secondary/60" aria-busy />
      ) : (
        <ul className="divide-y">
          {membros.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              {m.publicUserData?.imageUrl ? (
                <img
                  src={m.publicUserData.imageUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-full bg-secondary"
                />
              ) : (
                <span className="size-8 shrink-0 rounded-full bg-secondary" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {nome(m.publicUserData) ?? m.publicUserData?.identifier}
                </span>
                {nome(m.publicUserData) && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.publicUserData?.identifier}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {PAPEL[m.role] ?? m.role}
              </span>
            </li>
          ))}
          {convites.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="size-8 shrink-0 rounded-full border border-dashed" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {c.emailAddress}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                Convite pendente
              </span>
            </li>
          ))}
        </ul>
      )}
    </Seccao>
  )
}

function nome(
  u: { firstName?: string | null; lastName?: string | null } | undefined
): string | null {
  const n = [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim()
  return n.length > 0 ? n : null
}
