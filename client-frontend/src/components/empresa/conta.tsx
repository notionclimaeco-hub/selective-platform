import { useClerk, useUser } from "@clerk/tanstack-react-start"

import { Button } from "@/components/ui/button"
import { Seccao } from "./seccao"

/** The signed-in person: name and email, Clerk profile modal. Sign-out lives
 * in the `UserButton` menu (sidebar footer / phone top bar). */
export function SeccaoConta() {
  const { openUserProfile } = useClerk()
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const nome = user?.fullName ?? user?.username ?? email

  return (
    <Seccao
      id="conta"
      titulo="A minha conta"
      direita={
        <Button variant="outline" size="sm" onClick={() => openUserProfile()}>
          Gerir
        </Button>
      }
    >
      <div className="flex items-center gap-3">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt=""
            className="size-8 shrink-0 rounded-full bg-secondary"
          />
        ) : (
          <span className="size-8 shrink-0 rounded-full bg-secondary" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{nome}</span>
          {nome !== email && (
            <span className="block truncate text-xs text-muted-foreground">
              {email}
            </span>
          )}
        </span>
      </div>
    </Seccao>
  )
}
