import { useEffect, useMemo, useRef, useState } from "react"
import { useUser } from "@clerk/tanstack-react-start"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Utilizador = NonNullable<ReturnType<typeof useUser>["user"]>
type EnderecoEmail = Utilizador["emailAddresses"][number]
type Campo = "foto" | "nome" | "email" | "password"

/**
 * "A minha conta" editor over Clerk's `user` resource. Every property is a
 * row: label, value, small pencil. The pencil turns the value into an input
 * in place and becomes a save button; saving writes that one row and shows a
 * toast with "Reverter", which puts the previous value back.
 *
 * A new e-mail needs a code from Clerk: saving sends it and the row swaps to
 * a code input; saving again confirms it, makes it primary and drops the old
 * address. E-mail and password changes cannot be reverted from the toast.
 */
export function DialogConta({
  aberto,
  onAbertoChange,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
}) {
  const { user } = useUser()

  // `null` = row not being edited.
  const [nome, setNome] = useState<{
    primeiro: string
    apelido: string
  } | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState<{
    atual: string
    nova: string
  } | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [emailPendente, setEmailPendente] = useState<EnderecoEmail | null>(null)
  const [codigo, setCodigo] = useState("")
  const [aGuardar, setAGuardar] = useState<Campo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ficheiro = useRef<HTMLInputElement>(null)

  const fotoUrl = useMemo(
    () => (foto ? URL.createObjectURL(foto) : null),
    [foto]
  )
  useEffect(() => {
    return () => {
      if (fotoUrl) URL.revokeObjectURL(fotoUrl)
    }
  }, [fotoUrl])

  useEffect(() => {
    if (aberto) return
    setNome(null)
    setEmail(null)
    setPassword(null)
    setFoto(null)
    setEmailPendente(null)
    setCodigo("")
    setErro(null)
  }, [aberto])

  if (!user) return null

  const emailPrincipal = user.primaryEmailAddress?.emailAddress ?? ""
  const nomeActual = [user.firstName, user.lastName].filter(Boolean).join(" ")

  const alterouNome =
    nome !== null &&
    (nome.primeiro.trim() !== (user.firstName ?? "") ||
      nome.apelido.trim() !== (user.lastName ?? ""))
  const alterouEmail = emailPendente
    ? codigo.trim().length >= 6
    : email !== null &&
      email.trim() !== "" &&
      email.trim().toLowerCase() !== emailPrincipal.toLowerCase()
  const alterouPassword =
    password !== null &&
    password.nova.length >= 8 &&
    (!user.passwordEnabled || password.atual.length > 0)

  /** Runs one row's write, then toasts with an optional revert. */
  async function guardar(campo: Campo) {
    if (!user || aGuardar) return
    setAGuardar(campo)
    setErro(null)
    try {
      switch (campo) {
        case "foto": {
          if (!foto) return
          const antes = user.hasImage ? user.imageUrl : null
          await user.setProfileImage({ file: foto })
          setFoto(null)
          if (ficheiro.current) ficheiro.current.value = ""
          notificar("Fotografia guardada.", async () => {
            await user.setProfileImage({
              file: antes ? await ficheiroDeUrl(antes) : null,
            })
          })
          break
        }
        case "nome": {
          if (!alterouNome) return
          const antes = {
            firstName: user.firstName ?? "",
            lastName: user.lastName ?? "",
          }
          await user.update({
            firstName: nome.primeiro.trim(),
            lastName: nome.apelido.trim(),
          })
          setNome(null)
          notificar("Nome guardado.", () => user.update(antes))
          break
        }
        case "password": {
          if (!alterouPassword) return
          await user.updatePassword({
            currentPassword: user.passwordEnabled ? password.atual : undefined,
            newPassword: password.nova,
          })
          setPassword(null)
          notificar("Palavra-passe alterada.")
          break
        }
        case "email": {
          if (!alterouEmail) return
          if (emailPendente) {
            await emailPendente.attemptVerification({ code: codigo.trim() })
            await user.update({ primaryEmailAddressId: emailPendente.id })
            for (const antigo of user.emailAddresses) {
              if (antigo.id !== emailPendente.id) {
                await antigo.destroy().catch(() => undefined)
              }
            }
            setEmailPendente(null)
            setCodigo("")
            notificar("E-mail alterado.")
          } else if (email) {
            const novo = await user.createEmailAddress({ email: email.trim() })
            await novo.prepareVerification({ strategy: "email_code" })
            setEmail(null)
            setEmailPendente(novo)
            toast(`Código enviado para ${novo.emailAddress}.`)
          }
          break
        }
      }
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setAGuardar(null)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-2xl p-0 sm:max-w-xl"
      >
        <div className="flex min-h-14 items-center justify-between gap-3 border-b px-5">
          <DialogTitle className="text-sm font-semibold">
            A minha conta
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Fechar"
            onClick={() => onAbertoChange(false)}
          >
            <X />
          </Button>
        </div>

        <dl className="px-5">
          <Linha
            label="Fotografia"
            aEditar={foto !== null}
            podeGuardar={foto !== null}
            aGuardar={aGuardar === "foto"}
            onEditar={() => ficheiro.current?.click()}
            onGuardar={() => guardar("foto")}
            onCancelar={() => setFoto(null)}
            valor={
              <Avatar
                src={user.imageUrl}
                hasImage={user.hasImage}
                nome={nomeActual || user.username || emailPrincipal}
                className="size-10 text-xs"
              />
            }
            edicao={
              <Avatar
                src={fotoUrl}
                hasImage
                nome={nomeActual}
                className="size-10 ring-2 ring-ring/40"
              />
            }
          />
          <input
            ref={ficheiro}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          />

          <Linha
            label="Nome"
            aEditar={nome !== null}
            podeGuardar={alterouNome}
            aGuardar={aGuardar === "nome"}
            onEditar={() =>
              setNome({
                primeiro: user.firstName ?? "",
                apelido: user.lastName ?? "",
              })
            }
            onGuardar={() => guardar("nome")}
            onCancelar={() => setNome(null)}
            valor={nomeActual || <Vazio />}
            edicao={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  autoFocus
                  placeholder="Nome"
                  autoComplete="given-name"
                  value={nome?.primeiro ?? ""}
                  onChange={(e) =>
                    setNome((n) => ({ ...n!, primeiro: e.target.value }))
                  }
                />
                <Input
                  placeholder="Apelido"
                  autoComplete="family-name"
                  value={nome?.apelido ?? ""}
                  onChange={(e) =>
                    setNome((n) => ({ ...n!, apelido: e.target.value }))
                  }
                />
              </div>
            }
          />

          <Linha
            label="E-mail"
            aEditar={email !== null || emailPendente !== null}
            podeGuardar={alterouEmail}
            aGuardar={aGuardar === "email"}
            onEditar={() => setEmail(emailPrincipal)}
            onGuardar={() => guardar("email")}
            onCancelar={() => {
              setEmail(null)
              setEmailPendente(null)
              setCodigo("")
            }}
            valor={emailPrincipal || <Vazio />}
            edicao={
              emailPendente ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm">{emailPendente.emailAddress}</span>
                  <Input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Código enviado por e-mail"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                  />
                </div>
              ) : (
                <Input
                  autoFocus
                  type="email"
                  autoComplete="email"
                  value={email ?? ""}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )
            }
          />

          <Linha
            label="Palavra-passe"
            aEditar={password !== null}
            podeGuardar={alterouPassword}
            aGuardar={aGuardar === "password"}
            onEditar={() => setPassword({ atual: "", nova: "" })}
            onGuardar={() => guardar("password")}
            onCancelar={() => setPassword(null)}
            valor={<span className="tracking-widest">••••••••</span>}
            edicao={
              <div className="flex flex-col gap-2 sm:flex-row">
                {user.passwordEnabled && (
                  <Input
                    autoFocus
                    type="password"
                    placeholder="Palavra-passe atual"
                    autoComplete="current-password"
                    value={password?.atual ?? ""}
                    onChange={(e) =>
                      setPassword((p) => ({ ...p!, atual: e.target.value }))
                    }
                  />
                )}
                <Input
                  autoFocus={!user.passwordEnabled}
                  type="password"
                  placeholder="Nova palavra-passe"
                  autoComplete="new-password"
                  minLength={8}
                  value={password?.nova ?? ""}
                  onChange={(e) =>
                    setPassword((p) => ({ ...p!, nova: e.target.value }))
                  }
                />
              </div>
            }
          />
        </dl>

        {erro && (
          <p role="alert" className="px-5 pb-4 text-sm text-destructive">
            {erro}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Label, value (or the input while editing) and one small button: pencil to
 * edit; while editing, an X to cancel and a check to save. Enter saves,
 * Escape cancels.
 */
function Linha({
  label,
  valor,
  edicao,
  aEditar,
  podeGuardar,
  aGuardar,
  onEditar,
  onGuardar,
  onCancelar,
}: {
  label: string
  valor: React.ReactNode
  edicao: React.ReactNode
  aEditar: boolean
  podeGuardar: boolean
  aGuardar: boolean
  onEditar: () => void
  onGuardar: () => void
  onCancelar: () => void
}) {
  return (
    <div
      className="grid min-h-14 grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b py-3 text-sm last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
      onKeyDown={(e) => {
        if (!aEditar) return
        if (e.key === "Enter" && podeGuardar && !aGuardar) {
          e.preventDefault()
          onGuardar()
        } else if (e.key === "Escape") {
          e.stopPropagation()
          onCancelar()
        }
      }}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">
        {aEditar ? edicao : valor}
      </dd>
      {aEditar ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`Cancelar edição de ${label.toLowerCase()}`}
            disabled={aGuardar}
            onClick={onCancelar}
            className={cn(
              BOTAO_LINHA,
              "text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            )}
          >
            <X className="size-3" />
          </button>
          <button
            type="button"
            aria-label={`Guardar ${label.toLowerCase()}`}
            disabled={!podeGuardar || aGuardar}
            onClick={onGuardar}
            className={cn(
              BOTAO_LINHA,
              "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)] disabled:opacity-50"
            )}
          >
            {aGuardar ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" strokeWidth={2.5} />
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Editar ${label.toLowerCase()}`}
          onClick={onEditar}
          className={cn(
            BOTAO_LINHA,
            "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground"
          )}
        >
          <Pencil className="size-3" />
        </button>
      )}
    </div>
  )
}

const BOTAO_LINHA =
  "inline-flex size-6 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none"

function Vazio() {
  return <span className="text-muted-foreground">—</span>
}

/** "X guardado." with a "Reverter" action when the previous value is known. */
function notificar(texto: string, reverter?: () => Promise<unknown>) {
  toast(texto, {
    action: reverter
      ? {
          label: "Reverter",
          onClick: () => {
            reverter()
              .then(() => toast("Alteração revertida."))
              .catch((e: unknown) => toast.error(mensagemDeErro(e)))
          },
        }
      : undefined,
  })
}

/** Re-downloads a previous Clerk profile image so it can be uploaded back. */
async function ficheiroDeUrl(url: string): Promise<File> {
  const blob = await (await fetch(url)).blob()
  return new File([blob], "fotografia", { type: blob.type || "image/png" })
}

function mensagemDeErro(e: unknown): string {
  const erros = (
    e as { errors?: Array<{ longMessage?: string; message?: string }> }
  ).errors
  return (
    erros?.[0]?.longMessage ??
    erros?.[0]?.message ??
    "Não foi possível guardar."
  )
}
