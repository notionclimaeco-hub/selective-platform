import { useEffect, useState } from "react"
import { useUser } from "@clerk/tanstack-react-start"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DialogConta } from "./conta-dialog"
import { Seccao } from "./seccao"

/** The signed-in person: name and email; "Gerir" opens the in-app account
 * editor (`DialogConta`). `?conta=true` opens it too, for the user menu's
 * "Configurar conta". Sign-out lives in the `UserButton` menu. */
export function SeccaoConta() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { conta } = useSearch({ strict: false })
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    if (conta) setAberto(true)
  }, [conta])
  const fechar = (v: boolean) => {
    setAberto(v)
    if (!v && conta) void navigate({ to: "/empresa", search: {}, replace: true })
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const nome = user?.fullName ?? user?.username ?? email

  return (
    <Seccao
      id="conta"
      titulo="A minha conta"
      direita={
        <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
          Gerir
        </Button>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar src={user?.imageUrl} hasImage={user?.hasImage} nome={nome} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{nome}</span>
          {nome !== email && (
            <span className="block truncate text-xs text-muted-foreground">
              {email}
            </span>
          )}
        </span>
      </div>
      <DialogConta aberto={aberto} onAbertoChange={fechar} />
    </Seccao>
  )
}
